import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateProjectTransactionsBulk, getListProjectTransactionsQueryKey, getGetProjectQueryKey, getListProjectsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

export function ImportDialog({
  projectId, open, onOpenChange
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const bulkMutation = useCreateProjectTransactionsBulk();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleDownloadTemplate = () => {
    const headers = ["التاريخ", "الوصف", "النوع", "المبلغ", "اسم المحل", "اسم الشخص", "طريقة الدفع"];
    const example = ["2024-05-15", "شراء أسمنت", "مصروف", "1500", "شركة الأسمنت", "أحمد", "نقدي"];
    
    const csvContent = [
      headers.join(","),
      example.join(",")
    ].join("\n");
    
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "قالب_استيراد_الحركات.csv";
    link.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedRows = results.data as Record<string, string>[];
        
        const validRows: any[] = [];
        let hasErrors = false;

        parsedRows.forEach((row) => {
          try {
            const dateStr = row["التاريخ"] || row["Date"];
            const desc = row["الوصف"] || row["Description"];
            const rawType = row["النوع"] || row["Type"];
            const amountStr = row["المبلغ"] || row["Amount"];
            const shopName = row["اسم المحل"] || row["Shop"];
            const personName = row["اسم الشخص"] || row["Person"];
            const rawPaymentMethod = row["طريقة الدفع"] || row["Payment Method"];

            if (!dateStr || !desc || !rawType || !amountStr) {
              hasErrors = true;
              return;
            }

            const type = rawType.includes("مستلمة") || rawType.includes("إيداع") || rawType === "deposit" ? "deposit" : "expense";
            const amount = parseFloat(amountStr.replace(/,/g, ''));
            if (isNaN(amount) || amount <= 0) {
              hasErrors = true;
              return;
            }
            
            let paymentMethod = "cash";
            if (rawPaymentMethod) {
               if (rawPaymentMethod.includes("تحويل")) paymentMethod = "transfer";
               else if (rawPaymentMethod.includes("بطاقة")) paymentMethod = "card";
               else if (rawPaymentMethod.includes("صك")) paymentMethod = "check";
            }

            validRows.push({
              date: dateStr,
              description: desc,
              type,
              amount,
              shopName: shopName || undefined,
              personName: personName || undefined,
              paymentMethod,
            });
          } catch (err) {
            hasErrors = true;
          }
        });

        if (validRows.length === 0) {
          toast.error("لم يتم العثور على حركات صالحة. يرجى التأكد من تطابق الأعمدة.");
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        if (hasErrors) {
          toast.warning("تم تجاهل بعض الصفوف بسبب وجود أخطاء في البيانات.");
        }

        bulkMutation.mutate({ id: projectId, data: validRows }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProjectTransactionsQueryKey(projectId) });
            queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
            queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            toast.success(`تم استيراد ${validRows.length} حركة بنجاح.`);
            onOpenChange(false);
          },
          onError: () => {
            toast.error("حدث خطأ أثناء الاستيراد.");
          }
        });
        
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      error: () => {
        toast.error("فشل قراءة الملف.");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>استيراد حركات (إكسيل / CSV)</DialogTitle>
          <p className="text-right text-muted-foreground text-sm">
            يمكنك رفع ملف CSV يحتوي على الحركات لتسجيلها دفعة واحدة. يجب أن يحتوي الملف على الأعمدة بالترتيب التالي:
          </p>
        </DialogHeader>

        <div className="bg-muted p-4 rounded-md text-sm mb-4 overflow-x-auto" dir="rtl">
          <table className="w-full text-right min-w-[400px]">
            <thead>
              <tr className="border-b pb-2">
                <th className="py-2">التاريخ</th>
                <th>الوصف</th>
                <th>النوع</th>
                <th>المبلغ</th>
                <th>الأعمدة الاختيارية...</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-muted-foreground">
                <td className="py-2">2024-05-15</td>
                <td>شراء أسمنت</td>
                <td>مصروف</td>
                <td>1500</td>
                <td>اسم المحل، الشخص، طريقة الدفع</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex gap-4">
          <Button variant="outline" className="flex-1" onClick={handleDownloadTemplate} disabled={bulkMutation.isPending}>
            <Download className="mr-2 h-4 w-4" />
            تحميل قالب فارغ
          </Button>

          <Button className="flex-1 relative" disabled={bulkMutation.isPending}>
            {bulkMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                رفع الملف وتأكيد
                <input
                  type="file"
                  accept=".csv"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={bulkMutation.isPending}
                />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
