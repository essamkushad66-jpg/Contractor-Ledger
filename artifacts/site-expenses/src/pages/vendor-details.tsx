import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch, listVendors } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Loader2, ArrowLeft, Phone, User, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function VendorDetails() {
  const { id } = useParams();
  const vendorId = Number(id);

  const { data: vendors, isLoading: isLoadingVendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => listVendors(),
  });

  const { data: transactions, isLoading: isLoadingTx } = useQuery<any[]>({
    queryKey: ['vendor', vendorId, 'transactions'],
    queryFn: () => customFetch(`/api/vendors/${vendorId}/transactions`),
  });

  if (isLoadingVendors || isLoadingTx) {
    return <div className="flex justify-center items-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  const vendor = vendors?.find((v: any) => v.id === vendorId);

  if (!vendor) {
    return <div className="text-center py-20">المورد غير موجود</div>;
  }

  const totalPaid = transactions?.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0) || 0;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/vendors" className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors shrink-0 print:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{vendor.name}</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><User className="h-4 w-4" /> {vendor.type === 'worker' ? 'عامل / مقاول' : vendor.type === 'engineer' ? 'مهندس' : vendor.type === 'supplier' ? 'مورد' : 'أخرى'}</span>
            {vendor.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> <span dir="ltr">{vendor.phone}</span></span>}
          </div>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground mb-1">إجمالي المدفوعات عبر جميع المشاريع</p>
          <p className="text-3xl font-black text-destructive">{formatCurrency(totalPaid)}</p>
        </CardContent>
      </Card>

      <div className="space-y-4 mt-8">
        <h3 className="text-lg font-bold">سجل الحركات</h3>
        {!transactions || transactions.length === 0 ? (
          <div className="text-center p-10 border border-dashed rounded-xl text-muted-foreground bg-muted/20">
            لا توجد حركات مسجلة لهذا المورد.
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx: any) => (
              <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-card border rounded-lg shadow-sm gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-destructive/10 text-destructive">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">{tx.description}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                      <span>{formatDate(tx.date)}</span>
                      {tx.projectName && <span className="opacity-75">• 🏢 {tx.projectName}</span>}
                    </p>
                  </div>
                </div>
                <span className="font-black text-lg text-destructive" dir="ltr">
                  -{formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
