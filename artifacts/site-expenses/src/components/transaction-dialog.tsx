import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateProjectTransaction, useUpdateTransaction, getListProjectTransactionsQueryKey, getGetProjectQueryKey, getListProjectsQueryKey, getGetDashboardSummaryQueryKey, requestUploadUrl } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Camera, X } from "lucide-react";
import { toast } from "sonner";

const transactionSchema = z.object({
  type: z.enum(["deposit", "expense"]),
  amount: z.coerce.number().min(0.01, "المبلغ يجب أن يكون أكبر من 0"),
  description: z.string().min(1, "الوصف مطلوب"),
  date: z.string().min(1, "التاريخ مطلوب"),
  receiptPath: z.string().optional(),
  shopName: z.string().optional(),
  personName: z.string().optional(),
  paymentMethod: z.enum(["cash", "transfer", "card", "check"]).optional().default("cash"),
  deductionType: z.enum(["percentage", "amount"]).optional().default("percentage"),
  deductionValue: z.coerce.number().min(0, "لا يمكن أن تكون القيمة سالبة").optional().or(z.literal("")),
  deductionReason: z.string().optional(),
  transportCost: z.coerce.number().min(0, "لا يمكن أن تكون القيمة سالبة").optional().or(z.literal("")),
  laborCost: z.coerce.number().min(0, "لا يمكن أن تكون القيمة سالبة").optional().or(z.literal("")),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export function TransactionDialog({
  projectId, open, onOpenChange, type, defaultValues, transactionId
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "deposit" | "expense";
  defaultValues?: TransactionFormData;
  transactionId?: number;
}) {
  const queryClient = useQueryClient();
  const createMutation = useCreateProjectTransaction();
  const updateMutation = useUpdateTransaction();

  const isEdit = !!transactionId;

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: defaultValues || {
      type,
      amount: "" as unknown as number, // Let the user type it fresh
      description: "",
      date: new Date().toISOString().split('T')[0],
      shopName: "",
      personName: "",
      paymentMethod: "cash",
      deductionType: "percentage",
      deductionValue: "",
      deductionReason: "",
      transportCost: "",
      laborCost: "",
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Reset form when dialog opens/closes or type changes
  useEffect(() => {
    if (open) {
      setReceiptFile(null);
      form.reset(defaultValues || {
        type,
        amount: "" as unknown as number,
        description: "",
        shopName: "",
        personName: "",
        paymentMethod: "cash",
        deductionType: "percentage",
        deductionValue: "",
        deductionReason: "",
        transportCost: "",
        laborCost: "",
      });
    }
  }, [open, defaultValues, type, form]);

  const watchAmount = form.watch("amount");
  const watchDeductionType = form.watch("deductionType");
  const watchDeductionValue = form.watch("deductionValue");
  const watchTransport = form.watch("transportCost");
  const watchLabor = form.watch("laborCost");

  const calcGross = () => {
    const a = Number(watchAmount) || 0;
    const dv = Number(watchDeductionValue) || 0;
    const t = Number(watchTransport) || 0;
    const l = Number(watchLabor) || 0;
    
    let ded = 0;
    if (watchDeductionType === "percentage") {
      ded = a * dv / 100;
    } else {
      ded = dv;
    }
    
    return a + ded + t + l;
  };

  const onSubmit = async (values: TransactionFormData) => {
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListProjectTransactionsQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      onOpenChange(false);
      toast.success(isEdit ? "تم التعديل بنجاح" : "تم التسجيل بنجاح");
    };

    try {
      if (receiptFile) {
        setIsUploading(true);
        // 1. Get presigned URL
        const { uploadURL, objectPath } = await requestUploadUrl({
          name: receiptFile.name,
          size: receiptFile.size,
          contentType: receiptFile.type
        });
        
        // 2. Upload file directly to R2
        const uploadRes = await fetch(uploadURL, {
          method: 'PUT',
          body: receiptFile,
          headers: {
            'Content-Type': receiptFile.type,
          }
        });
        
        if (!uploadRes.ok) throw new Error("Upload failed");
        
        values.receiptPath = objectPath;
      }
    } catch (e) {
      toast.error("فشل رفع الصورة. تأكد من إعدادات التخزين السحابي.");
      setIsUploading(false);
      return;
    } finally {
      setIsUploading(false);
    }

    const submitData = { ...values };
    
    // Auto-calculate Gross Amount
    submitData.amount = calcGross();

    if (submitData.deductionValue === "" || submitData.deductionValue === 0) {
      submitData.deductionValue = undefined;
    }
    if (submitData.transportCost === "" || submitData.transportCost === 0) {
      submitData.transportCost = undefined;
    }
    if (submitData.laborCost === "" || submitData.laborCost === 0) {
      submitData.laborCost = undefined;
    }

    if (isEdit && transactionId) {
      updateMutation.mutate({ id: transactionId, data: submitData as any }, { onSuccess });
    } else {
      createMutation.mutate({ id: projectId, data: submitData as any }, { onSuccess });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "تعديل الحركة" : (type === "deposit" ? "تسجيل دفعة مستلمة" : "تسجيل مصروف")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>{type === "expense" ? "المبلغ الأساسي للفاتورة (د.ل)" : "المبلغ (د.ل)"}</Label>
            <Input 
              type="number" 
              step="any" 
              {...form.register("amount")} 
              placeholder={type === "expense" ? "مثال: 1500" : "مثال: 5000"} 
              dir="ltr" 
              className="text-right text-lg font-bold" 
            />
            {form.formState.errors.amount && <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>}
          </div>

          {(type === "expense" && calcGross() > Number(watchAmount || 0)) && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-md text-center">
              <span className="text-sm text-muted-foreground block mb-1">الإجمالي الذي سيتم خصمه من رصيد المشروع:</span>
              <span className="text-xl font-black text-primary" dir="ltr">{calcGross().toFixed(2)} د.ل</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>الوصف</Label>
            <Input {...form.register("description")} placeholder={type === "deposit" ? "مثال: دفعة من المالك" : "مثال: أسمنت وبلك"} />
            {form.formState.errors.description && <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input type="date" {...form.register("date")} />
            {form.formState.errors.date && <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم المحل (اختياري)</Label>
              <Input {...form.register("shopName")} placeholder="مثال: شركة الأسمنت" />
            </div>
            <div className="space-y-2">
              <Label>اسم الشخص (اختياري)</Label>
              <Input {...form.register("personName")} placeholder="الشخص المستلم/الدافع" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>طريقة الدفع</Label>
            <Select 
              value={form.watch("paymentMethod")} 
              onValueChange={(val: any) => form.setValue("paymentMethod", val)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">نقدي (Cash)</SelectItem>
                <SelectItem value="transfer">تحويل بنكي (Transfer)</SelectItem>
                <SelectItem value="card">بطاقة (Card)</SelectItem>
                <SelectItem value="check">صك (Check)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "expense" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg border border-border">
                <div className="space-y-2">
                  <Label>الخصم / التوريد (اختياري)</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={form.watch("deductionType")} 
                      onValueChange={(val: any) => form.setValue("deductionType", val)}
                    >
                      <SelectTrigger className="w-[100px] shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">نسبة %</SelectItem>
                        <SelectItem value="amount">رقم ثابت</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input 
                      type="number" 
                      step="any" 
                      {...form.register("deductionValue")} 
                      placeholder={form.watch("deductionType") === "percentage" ? "10" : "150"} 
                      dir="ltr" 
                      className="text-right" 
                    />
                  </div>
                  {form.formState.errors.deductionValue && <p className="text-sm text-destructive">{form.formState.errors.deductionValue.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>سبب الخصم (اختياري)</Label>
                  <Input {...form.register("deductionReason")} placeholder="مثال: عمولة / نسبة توريد" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-muted/10 p-3 rounded-lg border border-border border-dashed">
                <div className="space-y-2">
                  <Label>تكلفة النقل (اختياري)</Label>
                  <Input 
                    type="number" 
                    step="any" 
                    {...form.register("transportCost")} 
                    placeholder="مثال: 50" 
                    dir="ltr" 
                    className="text-right" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>اليد العاملة (اختياري)</Label>
                  <Input 
                    type="number" 
                    step="any" 
                    {...form.register("laborCost")} 
                    placeholder="مثال: 100" 
                    dir="ltr" 
                    className="text-right" 
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>صورة الفاتورة / الإيصال (اختياري)</Label>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={(e) => {
                if (e.target.files?.[0]) setReceiptFile(e.target.files[0]);
              }}
            />
            {receiptFile || form.watch('receiptPath') ? (
              <div className="flex items-center justify-between p-2 border rounded bg-muted/50">
                <span className="text-sm truncate max-w-[200px]">
                  {receiptFile ? receiptFile.name : 'صورة مرفقة مسبقاً'}
                </span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-destructive"
                  onClick={() => {
                    setReceiptFile(null);
                    form.setValue('receiptPath', undefined);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button 
                type="button" 
                variant="outline" 
                className="w-full border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" />
                إرفاق صورة
              </Button>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending || isUploading}>إلغاء</Button>
            <Button type="submit" disabled={isPending || isUploading} variant={type === "deposit" ? "success" : "destructive"}>
              {(isPending || isUploading) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {isUploading ? "جاري الرفع..." : "حفظ"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
