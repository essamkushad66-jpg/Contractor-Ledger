import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetProject, useListProjectTransactions, useDeleteProject, getListProjectsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, Edit, Trash2, Building2, MapPin, Loader2, ArrowLeft, Printer, Download, Image as ImageIcon, Users, Upload } from "lucide-react";
import { Link } from "wouter";
import { exportTransactionsToCSV } from "@/lib/export";
import { customFetch } from "@workspace/api-client-react";
import { ProjectDialog } from "@/components/project-dialog";
import { TransactionDialog } from "@/components/transaction-dialog";
import { MembersDialog } from "@/components/members-dialog";
import { ImportDialog } from "@/components/import-dialog";
import { PrintableReport } from "@/components/printable-report";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { useRef } from "react";
import { toast } from "sonner";
import { useDeleteTransaction, getListProjectTransactionsQueryKey, getGetProjectQueryKey } from "@workspace/api-client-react";

export default function ProjectDetails() {
  const { id } = useParams();
  const projectId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const componentRef = useRef<HTMLDivElement>(null);

  const { data: project, isLoading: isLoadingProject } = useGetProject(projectId);
  const { data: transactions, isLoading: isLoadingTransactions } = useListProjectTransactions(projectId);
  const deleteProjectMutation = useDeleteProject();
  const deleteTransactionMutation = useDeleteTransaction();

  // Dialog states
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  const [transactionType, setTransactionType] = useState<"deposit" | "expense">("deposit");
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [editTransactionId, setEditTransactionId] = useState<number | undefined>();
  const [editTransactionDefault, setEditTransactionDefault] = useState<any>();
  
  const [deleteTransactionId, setDeleteTransactionId] = useState<number | undefined>();

  const openTransactionDialog = (type: "deposit" | "expense", id?: number, defaultVals?: any) => {
    setTransactionType(type);
    setEditTransactionId(id);
    setEditTransactionDefault(defaultVals);
    setTransactionDialogOpen(true);
  };

  const handleDeleteProject = () => {
    deleteProjectMutation.mutate({ id: projectId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast.success("تم حذف المشروع بنجاح");
        setLocation("/");
      }
    });
  };

  const handleDeleteTransaction = () => {
    if (!deleteTransactionId) return;
    deleteTransactionMutation.mutate({ id: deleteTransactionId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectTransactionsQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setDeleteTransactionId(undefined);
        toast.success("تم حذف الحركة بنجاح");
      }
    });
  };

  const viewReceipt = async (path: string) => {
    try {
      const toastId = toast.loading("جاري تحميل الصورة...");
      // Using customFetch ensures the Clerk authentication token is attached securely
      const res = await customFetch(path) as unknown as Response;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.dismiss(toastId);
    } catch (e) {
      toast.error("فشل تحميل الصورة. قد تكون محذوفة أو لا تملك صلاحية.");
      toast.dismiss();
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: project ? `تقرير_حركات_${project.name.replace(/\s+/g, "_")}` : "تقرير_حركات",
  });

  if (isLoadingProject) {
    return <div className="flex justify-center items-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (!project) {
    return <div className="text-center py-20">المشروع غير موجود</div>;
  }

  return (
    <div className="space-y-6 pb-20">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors print:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {project.clientName}</span>
              {project.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {project.location}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="icon" onClick={() => setMembersDialogOpen(true)} title="مشاركة المشروع">
            <Users className="h-4 w-4" />
          </Button>
          {project.currentUserRole !== 'viewer' && (
            <Button variant="outline" size="icon" onClick={() => setImportDialogOpen(true)} title="استيراد حركات (إكسيل / CSV)">
              <Upload className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => exportTransactionsToCSV(project as any, transactions as any)} title="تصدير كملف إكسيل (CSV)">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => handlePrint()} title="طباعة التقرير">
            <Printer className="h-4 w-4" />
          </Button>
          {project.currentUserRole !== 'viewer' && (
            <Button variant="ghost" size="icon" onClick={() => setEditProjectOpen(true)}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {project.currentUserRole === 'owner' && (
            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteProjectOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Massive Balance Card */}
      <Card className={`overflow-hidden border-2 ${project.balance >= 0 ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'} print:border-foreground/20 print:bg-transparent print:shadow-none`}>
        <CardContent className="p-8 sm:p-10 text-center">
          <p className="text-sm sm:text-base font-medium text-muted-foreground mb-2">الرصيد المتبقي في الجيب</p>
          <div className={`text-5xl sm:text-6xl font-black tracking-tight ${project.balance >= 0 ? 'text-success' : 'text-destructive'} print:text-foreground`}>
            {formatCurrency(project.balance)}
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-border/50 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">إجمالي المستلم</p>
              <p className="text-xl font-bold text-success">{formatCurrency(project.totalReceived)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">إجمالي المصروف</p>
              <p className="text-xl font-bold text-destructive">{formatCurrency(project.totalSpent)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {project.currentUserRole !== 'viewer' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:hidden">
          <Button size="lg" variant="success" className="h-14 text-base shadow-sm" onClick={() => openTransactionDialog("deposit")}>
            <ArrowDownRight className="ml-2 h-5 w-5" />
            تسجيل دفعة مستلمة
          </Button>
          <Button size="lg" variant="destructive" className="h-14 text-base shadow-sm" onClick={() => openTransactionDialog("expense")}>
            <ArrowUpRight className="ml-2 h-5 w-5" />
            تسجيل مصروف
          </Button>
        </div>
      )}

      {/* Transactions List */}
      <div className="mt-8 space-y-4">
        <h3 className="text-lg font-bold">سجل الحركات</h3>
        
        {isLoadingTransactions ? (
          <div className="flex justify-center p-8 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : !transactions || transactions.length === 0 ? (
          <div className="text-center p-10 border border-dashed rounded-xl text-muted-foreground bg-muted/20">
            لا توجد حركات مسجلة بعد لهذا المشروع.
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-card border rounded-lg shadow-sm hover:shadow transition-shadow print:shadow-none print:break-inside-avoid print:border-foreground/30 print:bg-transparent">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'deposit' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {tx.type === 'deposit' ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">{tx.description}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{formatDate(tx.date)}</span>
                      {tx.paymentMethod && (
                        <span>• {tx.paymentMethod === 'cash' ? 'نقدي' : tx.paymentMethod === 'transfer' ? 'تحويل بنكي' : tx.paymentMethod === 'card' ? 'بطاقة' : 'صك'}</span>
                      )}
                      {tx.shopName && <span className="opacity-75">• 🏪 {tx.shopName}</span>}
                      {tx.personName && <span className="opacity-75">• 👤 {tx.personName}</span>}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className={`font-black text-lg ${tx.type === 'deposit' ? 'text-success' : 'text-destructive'}`} dir="ltr">
                    {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                  
                  <div className="flex gap-1 print:hidden">
                    {tx.receiptPath && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary" onClick={() => viewReceipt(tx.receiptPath!)} title="عرض الإيصال">
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    )}
                    {project.currentUserRole !== 'viewer' && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openTransactionDialog(tx.type, tx.id, {
                          type: tx.type,
                          amount: tx.amount,
                          description: tx.description,
                          date: tx.date.split('T')[0],
                          shopName: tx.shopName || "",
                          personName: tx.personName || "",
                          paymentMethod: tx.paymentMethod || "cash"
                        })}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteTransactionId(tx.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ProjectDialog 
        open={editProjectOpen} 
        onOpenChange={setEditProjectOpen} 
        projectId={projectId}
        defaultValues={{
          name: project.name,
          clientName: project.clientName,
          location: project.location || "",
          notes: project.notes || ""
        }}
      />
      
      <ConfirmDialog 
        open={deleteProjectOpen} 
        onOpenChange={setDeleteProjectOpen} 
        title="حذف المشروع"
        description="هل أنت متأكد من حذف هذا المشروع؟ سيتم حذف جميع الحركات المالية المرتبطة به ولا يمكن التراجع عن هذا الإجراء."
        onConfirm={handleDeleteProject}
        isPending={deleteProjectMutation.isPending}
      />
      
      <TransactionDialog 
        projectId={projectId}
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
        type={transactionType}
        transactionId={editTransactionId}
        defaultValues={editTransactionDefault}
      />
      
      <ConfirmDialog 
        open={!!deleteTransactionId} 
        onOpenChange={(open) => !open && setDeleteTransactionId(undefined)} 
        title="حذف الحركة"
        description="هل أنت متأكد من حذف هذه الحركة المالية؟ سيتم تحديث رصيد المشروع تلقائياً."
        onConfirm={handleDeleteTransaction}
        isPending={deleteTransactionMutation.isPending}
      />

      <MembersDialog
        projectId={projectId}
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
        currentUserRole={project.currentUserRole as "owner" | "editor" | "viewer"}
      />

      <ImportDialog
        projectId={projectId}
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      <div style={{ display: "none" }}>
        <PrintableReport 
          ref={componentRef} 
          project={project as any} 
          transactions={(transactions || []) as any} 
        />
      </div>
    </div>
  );
}
