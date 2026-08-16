import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const recurringSchema = z.object({
  amount: z.coerce.number().min(0.01, "المبلغ يجب أن يكون أكبر من 0"),
  description: z.string().min(1, "الوصف مطلوب"),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  startDate: z.string().min(1, "تاريخ البدء مطلوب"),
  category: z.enum(["materials", "labor", "transport", "permits", "equipment", "others"]).optional().default("others"),
});

type RecurringFormData = z.infer<typeof recurringSchema>;

export function RecurringDialog({
  projectId,
  open,
  onOpenChange
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RecurringFormData>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      amount: "" as unknown as number,
      description: "",
      frequency: "monthly",
      startDate: (() => {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      })(),
      category: "others",
    }
  });

  const onSubmit = async (values: RecurringFormData) => {
    setIsSubmitting(true);
    try {
      await customFetch(`/api/projects/${projectId}/recurring`, {
        method: "POST",
        body: JSON.stringify(values)
      });
      
      toast.success("تم إضافة المصروف الدوري بنجاح");
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/recurring`] });
      
      form.reset();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء حفظ المصروف الدوري");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && !isSubmitting) {
        form.reset();
        onOpenChange(false);
      } else if (val) {
        onOpenChange(true);
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>إضافة مصروف دوري</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>المبلغ</Label>
            <Input 
              type="number" 
              step="any" 
              {...form.register("amount")} 
              placeholder="مثال: 1500" 
              dir="ltr" 
              className="text-right text-lg font-bold" 
            />
            {form.formState.errors.amount && <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>الوصف</Label>
            <Input {...form.register("description")} placeholder="مثال: إيجار المعدات" />
            {form.formState.errors.description && <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>التكرار</Label>
              <Select 
                value={form.watch("frequency")} 
                onValueChange={(val: any) => form.setValue("frequency", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">أسبوعي</SelectItem>
                  <SelectItem value="biweekly">نصف شهري</SelectItem>
                  <SelectItem value="monthly">شهري</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>التصنيف</Label>
              <Select 
                value={form.watch("category")} 
                onValueChange={(val: any) => form.setValue("category", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="materials">مواد بناء</SelectItem>
                  <SelectItem value="labor">عمالة</SelectItem>
                  <SelectItem value="transport">نقل وتوصيل</SelectItem>
                  <SelectItem value="equipment">معدات وآليات</SelectItem>
                  <SelectItem value="permits">تراخيص ورسوم</SelectItem>
                  <SelectItem value="others">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>تاريخ البدء</Label>
            <Input type="date" {...form.register("startDate")} />
            {form.formState.errors.startDate && <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>إلغاء</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
