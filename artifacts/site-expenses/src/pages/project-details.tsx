import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useGetProject, useListProjectTransactions, useDeleteProject, getListProjectsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, Edit, Trash2, Building2, MapPin, Loader2, ArrowLeft, Printer, Download, Image as ImageIcon, Users, Upload, Search, Filter } from "lucide-react";
import { Link } from "wouter";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportTransactionsToCSV } from "@/lib/export";
import { customFetch } from "@workspace/api-client-react";
import { ProjectDialog } from "@/components/project-dialog";
import { TransactionDialog } from "@/components/transaction-dialog";
import { MembersDialog } from "@/components/members-dialog";
import { ImportDialog } from "@/components/import-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDeleteTransaction, getListProjectTransactionsQueryKey, getGetProjectQueryKey } from "@workspace/api-client-react";

export default function ProjectDetails() {
  const { id } = useParams();
  const projectId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

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

  // Filtering states
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredTransactions = useMemo(() => {
    return transactions?.filter(tx => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (categoryFilter !== "all" && (tx as any).category !== categoryFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return tx.description.toLowerCase().includes(term) ||
               (tx.personName && tx.personName.toLowerCase().includes(term)) ||
               (tx.shopName && tx.shopName.toLowerCase().includes(term));
      }
      return true;
    });
  }, [transactions, typeFilter, categoryFilter, searchTerm]);

  const categoryData = useMemo(() => {
    if (!transactions) return [];
    const expenses = transactions.filter(t => t.type === 'expense');
    const categories: Record<string, number> = {};
    expenses.forEach(tx => {
      const cat = (tx as any).category || 'others';
      categories[cat] = (categories[cat] || 0) + Number(tx.amount);
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [transactions]);

  const CATEGORY_COLORS: Record<string, string> = {
    materials: 'hsl(215 100% 50%)',
    labor: 'hsl(142 70% 40%)',
    transport: 'hsl(30 90% 50%)',
    permits: 'hsl(280 70% 50%)',
    equipment: 'hsl(348 80% 50%)',
    others: 'hsl(215 16% 47%)',
  };
  
  const CATEGORY_LABELS: Record<string, string> = {
    materials: 'مواد بناء',
    labor: 'عمالة',
    transport: 'نقل',
    permits: 'تراخيص',
    equipment: 'معدات',
    others: 'أخرى',
  };

  const { totalTransport, totalLabor, totalDeduction } = useMemo(() => {
    let t = 0, l = 0, d = 0;
    transactions?.forEach(tx => {
      const transport = Number(tx.transportCost) || 0;
      const labor = Number(tx.laborCost) || 0;
      const dv = Number(tx.deductionValue) || 0;
      const amount = Number(tx.amount) || 0;
      const isPerc = tx.deductionType !== 'amount';
      const baseAmount = isPerc ? ((amount - transport - labor) / (1 + (dv / 100))) : (amount - transport - labor - dv);
      const dedAmount = isPerc ? (baseAmount * (dv / 100)) : dv;
      
      t += transport;
      l += labor;
      d += dedAmount;
    });
    return { totalTransport: t, totalLabor: l, totalDeduction: d };
  }, [transactions]);

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
          <Button variant="outline" size="icon" onClick={() => window.open(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/projects/${projectId}/print`, '_blank')} title="طباعة التقرير">
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
          {(totalTransport > 0 || totalLabor > 0 || totalDeduction > 0) && (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/50 text-xs sm:text-sm">
              {totalDeduction > 0 && (
                <div>
                  <p className="text-muted-foreground mb-0.5">عمولات وخصومات</p>
                  <p className="font-bold text-destructive">{formatCurrency(totalDeduction)}</p>
                </div>
              )}
              {totalTransport > 0 && (
                <div>
                  <p className="text-muted-foreground mb-0.5">نقل وتوصيل</p>
                  <p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalTransport)}</p>
                </div>
              )}
              {totalLabor > 0 && (
                <div>
                  <p className="text-muted-foreground mb-0.5">يد عاملة</p>
                  <p className="font-bold text-amber-600 dark:text-amber-500">{formatCurrency(totalLabor)}</p>
                </div>
              )}
            </div>
          )}
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

      {/* Analytics & Charts */}
      {categoryData.length > 0 && (
        <Card className="print:hidden shadow-sm mt-8">
          <CardContent className="p-4 sm:p-6 flex flex-col items-center">
            <h3 className="text-lg font-bold mb-4 w-full text-center">تحليل المصاريف حسب التصنيف</h3>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS.others} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => CATEGORY_LABELS[label as string] || label}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))', direction: 'rtl' }}
                  />
                  <Legend formatter={(value) => CATEGORY_LABELS[value as string] || value} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden mt-8">
        <div className="relative">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="بحث (الوصف، المحل، الشخص)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <div className="flex items-center gap-2"><Filter className="h-4 w-4 opacity-50" /> <SelectValue placeholder="نوع الحركة" /></div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحركات</SelectItem>
            <SelectItem value="deposit">الدفعات المستلمة فقط</SelectItem>
            <SelectItem value="expense">المصاريف فقط</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <div className="flex items-center gap-2"><Filter className="h-4 w-4 opacity-50" /> <SelectValue placeholder="التصنيف" /></div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع التصنيفات</SelectItem>
            <SelectItem value="materials">مواد بناء</SelectItem>
            <SelectItem value="labor">عمالة</SelectItem>
            <SelectItem value="transport">نقل</SelectItem>
            <SelectItem value="equipment">معدات</SelectItem>
            <SelectItem value="permits">تراخيص</SelectItem>
            <SelectItem value="others">أخرى</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transactions List */}
      <div className="mt-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold">سجل الحركات</h3>
          {filteredTransactions && <span className="text-sm text-muted-foreground">{filteredTransactions.length} حركة</span>}
        </div>
        
        {isLoadingTransactions ? (
          <div className="flex justify-center p-8 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : !transactions || transactions.length === 0 ? (
          <div className="text-center p-10 border border-dashed rounded-xl text-muted-foreground bg-muted/20">
            لا توجد حركات مسجلة بعد لهذا المشروع.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions?.map((tx) => (
              <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 bg-card border rounded-lg shadow-sm hover:shadow transition-shadow print:shadow-none print:break-inside-avoid print:border-foreground/30 print:bg-transparent overflow-hidden">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 overflow-hidden w-full sm:w-auto">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 mt-1 sm:mt-0 ${tx.type === 'deposit' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {tx.type === 'deposit' ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="whitespace-nowrap">{formatDate(tx.date)}</span>
                      {tx.paymentMethod && (
                        <span className="whitespace-nowrap">• {tx.paymentMethod === 'cash' ? 'نقدي' : tx.paymentMethod === 'transfer' ? 'تحويل بنكي' : tx.paymentMethod === 'card' ? 'بطاقة' : 'صك'}</span>
                      )}
                      {tx.shopName && <span className="opacity-75 truncate max-w-[100px] sm:max-w-none">• 🏪 {tx.shopName}</span>}
                      {tx.personName && <span className="opacity-75 truncate max-w-[100px] sm:max-w-none">• 👤 {tx.personName}</span>}
                      {tx.type === 'expense' && (tx as any).category && (tx as any).category !== 'others' && (
                        <span className="opacity-100 mr-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                          {CATEGORY_LABELS[(tx as any).category] || (tx as any).category}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-1 w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/50 shrink-0">
                  <div className="flex items-center justify-between sm:justify-end w-full gap-2 sm:gap-4">
                    <span className={`font-black text-base sm:text-lg whitespace-nowrap ${tx.type === 'deposit' ? 'text-success' : 'text-destructive'}`} dir="ltr">
                      {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                    
                    <div className="flex gap-1 print:hidden shrink-0">
                      {tx.receiptPath && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary" onClick={() => viewReceipt(tx.receiptPath!)} title="عرض الإيصال">
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      )}
                    {project.currentUserRole !== 'viewer' && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => {
                          const t = tx.transportCost || 0;
                          const l = tx.laborCost || 0;
                          const dv = tx.deductionValue || 0;
                          const isPerc = tx.deductionType !== 'amount';
                          const baseAmount = isPerc ? ((tx.amount - t - l) / (1 + (dv / 100))) : (tx.amount - t - l - dv);
                          
                          openTransactionDialog(tx.type, tx.id, {
                            type: tx.type,
                            amount: baseAmount,
                            description: tx.description,
                            date: tx.date.split('T')[0],
                            shopName: tx.shopName || "",
                            personName: tx.personName || "",
                            category: (tx as any).category || "others",
                            paymentMethod: tx.paymentMethod || "cash",
                            deductionType: tx.deductionType || "percentage",
                            deductionValue: tx.deductionValue || "",
                            deductionReason: tx.deductionReason || "",
                            transportCost: tx.transportCost || "",
                            laborCost: tx.laborCost || "",
                          });
                        }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteTransactionId(tx.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {(tx.deductionValue || tx.transportCost || tx.laborCost) ? (
                  (() => {
                    const t = tx.transportCost || 0;
                    const l = tx.laborCost || 0;
                    const dv = tx.deductionValue || 0;
                    const isPerc = tx.deductionType !== 'amount';
                    const baseAmount = isPerc ? ((tx.amount - t - l) / (1 + (dv / 100))) : (tx.amount - t - l - dv);
                    const dedAmount = isPerc ? (baseAmount * (dv / 100)) : dv;
                    
                    return (
                      <div className="text-[11px] sm:text-xs flex flex-col items-end mt-2 px-3 py-2 bg-muted/30 rounded border border-border/50 w-full sm:w-auto min-w-[200px]">
                        <div className="flex justify-between w-full mb-1 pb-1 border-b border-border/30">
                          <span className="font-medium text-foreground">الصافي:</span>
                          <span className="font-bold">{formatCurrency(baseAmount)}</span>
                        </div>
                        {dv > 0 && (
                          <div className="flex justify-between w-full text-destructive">
                            <span>{tx.deductionReason || 'خصم'} {isPerc ? `(${dv}%)` : ''}:</span>
                            <span>{formatCurrency(dedAmount)}</span>
                          </div>
                        )}
                        {t > 0 && (
                          <div className="flex justify-between w-full text-blue-600 dark:text-blue-400 mt-0.5">
                            <span>تكلفة النقل:</span>
                            <span>{formatCurrency(t)}</span>
                          </div>
                        )}
                        {l > 0 && (
                          <div className="flex justify-between w-full text-amber-600 dark:text-amber-500 mt-0.5">
                            <span>اليد العاملة:</span>
                            <span>{formatCurrency(l)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : null}
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
    </div>
  );
}
