import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useGetProject, useListProjectTransactions, useDeleteProject, getListProjectsQueryKey, getGetDashboardSummaryQueryKey, useListVendors } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowUpRight, ArrowDownRight, Edit, Trash2, Building2, MapPin, Loader2, ArrowLeft, Printer, Download, Image as ImageIcon, Users, Upload, Search, Filter, AlertTriangle, TrendingUp, TrendingDown, Percent, Camera } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PhotoUploadDialog } from "@/components/photo-upload-dialog";
import { RecurringDialog } from "@/components/recurring-dialog";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDeleteTransaction, getListProjectTransactionsQueryKey, getGetProjectQueryKey } from "@workspace/api-client-react";
import { ChangeOrderDialog } from "@/components/change-order-dialog";

export default function ProjectDetails() {
  const { id } = useParams();
  const projectId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [viewingReceipt, setViewingReceipt] = useState<{url: string, type: string} | null>(null);

  const { data: project, isLoading: isLoadingProject } = useGetProject(projectId);
  const { data: transactions, isLoading: isLoadingTransactions } = useListProjectTransactions(projectId);
  const deleteProjectMutation = useDeleteProject();
  const deleteTransactionMutation = useDeleteTransaction();
  const { data: vendorsRes } = useListVendors();
  const vendors = vendorsRes || [];

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
  const [changeOrderDialogOpen, setChangeOrderDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);

  // Queries for new tabs
  const { data: photos, isLoading: isLoadingPhotos } = useQuery({
    queryKey: [`/api/projects/${projectId}/photos`],
    queryFn: () => customFetch(`/api/projects/${projectId}/photos`)
  });

  const { data: recurringList, isLoading: isLoadingRecurring } = useQuery({
    queryKey: [`/api/projects/${projectId}/recurring`],
    queryFn: () => customFetch(`/api/projects/${projectId}/recurring`),
    enabled: project?.currentUserRole !== 'site_manager'
  });

  const { data: changeOrders } = useQuery({
    queryKey: ["change-orders", projectId],
    queryFn: () => customFetch(`/api/projects/${projectId}/change-orders`),
  });

  const { data: activities } = useQuery({
    queryKey: ["activity", projectId],
    queryFn: () => customFetch(`/api/projects/${projectId}/activity`),
  });

  // Filtering states
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredTransactions = useMemo(() => {
    return transactions?.filter(tx => {
      if (project?.currentUserRole === 'site_manager' && tx.type === 'deposit') return false;
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
  }, [transactions, typeFilter, categoryFilter, searchTerm, project?.currentUserRole]);

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

  const adjustedBudget = useMemo(() => {
    if (!project?.budget) return 0;
    const approvedSum = (changeOrders as any[])?.filter(co => co.status === 'approved').reduce((acc, co) => acc + Number(co.amountChange), 0) || 0;
    return Number(project.budget) + approvedSum;
  }, [project?.budget, changeOrders]);

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
      const toastId = toast.loading("جاري تحميل المرفق...");
      
      let blob: Blob;
      if (path.startsWith('data:')) {
        const arr = path.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], {type:mime});
      } else {
        const fetchPath = path.startsWith('/objects/') ? `/api/storage${path}` : path;
        blob = await customFetch(fetchPath, { responseType: 'blob' }) as Blob;
      }
      
      const url = URL.createObjectURL(blob);
      setViewingReceipt({ url, type: blob.type });
      toast.dismiss(toastId);
    } catch (e) {
      toast.error("فشل تحميل المرفق. قد يكون محذوفاً أو لا تملك صلاحية.");
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors shrink-0 print:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate" title={project.name}>{project.name}</h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 truncate">
              <span className="flex items-center gap-1 shrink-0"><Building2 className="h-3 w-3" /> <span className="truncate max-w-[120px] sm:w-auto">{project.clientName}</span></span>
              {project.location && <span className="flex items-center gap-1 shrink-0"><MapPin className="h-3 w-3" /> <span className="truncate max-w-[100px] sm:w-auto">{project.location}</span></span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden self-end sm:self-auto w-full sm:w-auto justify-end">
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

      {project.currentUserRole !== 'site_manager' && adjustedBudget > 0 && (() => {
        const spentPercent = (project.totalSpent / adjustedBudget) * 100;
        if (spentPercent >= 100) {
          return (
            <div className="bg-destructive/20 text-destructive border-r-4 border-destructive p-4 rounded-md flex items-center gap-3 print:hidden">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="font-bold">❌ تجاوز المصاريف الميزانية المخصصة!</p>
            </div>
          );
        } else if (spentPercent >= 95) {
          return (
            <div className="bg-destructive/10 text-destructive border-r-4 border-destructive p-4 rounded-md flex items-center gap-3 print:hidden">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="font-bold">🚨 تم صرف 95% من الميزانية! يرجى مراجعة المصاريف</p>
            </div>
          );
        } else if (spentPercent >= 80) {
          return (
            <div className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-r-4 border-amber-500 p-4 rounded-md flex items-center gap-3 print:hidden">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="font-bold">⚠️ تم صرف 80% من الميزانية المخصصة</p>
            </div>
          );
        }
        return null;
      })()}

      <Card className={`overflow-hidden border-2 ${project.balance >= 0 ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'} print:border-foreground/20 print:bg-transparent print:shadow-none`}>
        <CardContent className="p-8 sm:p-10 text-center">
          <p className="text-sm sm:text-base font-medium text-muted-foreground mb-2">الرصيد المتبقي في الجيب</p>
          <div className={`text-4xl sm:text-5xl md:text-6xl font-black tracking-tight ${project.balance >= 0 ? 'text-success' : 'text-destructive'} print:text-foreground break-words`}>
            {formatCurrency(project.balance)}
          </div>
          
          <div className={`grid ${project.currentUserRole === 'site_manager' ? 'grid-cols-1' : 'grid-cols-2'} gap-4 mt-8 pt-6 border-t border-border/50 text-sm`}>
            {project.currentUserRole !== 'site_manager' && (
              <div>
                <p className="text-muted-foreground mb-1">إجمالي المستلم</p>
                <p className="text-xl font-bold text-success">{formatCurrency(project.totalReceived)}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground mb-1">إجمالي المصروف</p>
              <p className="text-xl font-bold text-destructive">{formatCurrency(project.totalSpent)}</p>
            </div>
          </div>
          {project.currentUserRole !== 'site_manager' && adjustedBudget > 0 && (
            <div className="mt-6 pt-4 border-t border-border/50">
              <div className="flex justify-between items-end mb-2">
                <p className="text-sm font-bold text-muted-foreground">
                  الميزانية: <span className="text-foreground">{formatCurrency(adjustedBudget)}</span>
                </p>
                <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full">{Math.round((project.totalSpent / adjustedBudget) * 100)}%</span>
              </div>
              <Progress value={Math.min(100, (project.totalSpent / adjustedBudget) * 100)} className="h-2" />
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/50">
            {totalDeduction > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">عمولات وخصومات</p>
                <p className="font-bold text-sm text-destructive truncate">{formatCurrency(totalDeduction)}</p>
              </div>
            )}
            {totalTransport > 0 && (
              <div className="bg-blue-500/10 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">نقل وتوصيل</p>
                <p className="font-bold text-sm text-blue-600 dark:text-blue-400 truncate">{formatCurrency(totalTransport)}</p>
              </div>
            )}
            {totalLabor > 0 && (
              <div className="bg-amber-500/10 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">يد عاملة</p>
                <p className="font-bold text-sm text-amber-600 dark:text-amber-500 truncate">{formatCurrency(totalLabor)}</p>
              </div>
            )}
            {categoryData.filter(c => !['transport', 'labor'].includes(c.name)).map(cat => (
              <div key={cat.name} className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">{CATEGORY_LABELS[cat.name] || cat.name}</p>
                <p className="font-bold text-sm truncate" title={formatCurrency(cat.value)}>{formatCurrency(cat.value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {project.currentUserRole !== 'site_manager' && (
        <Card className="print:hidden border-border/50">
          <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className={`p-3 rounded-full shrink-0 ${project.balance >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                {project.balance >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">إجمالي الربح (الرصيد)</p>
                <p className={`text-2xl font-bold ${project.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(project.balance)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-r border-border/50 pt-4 sm:pt-0 sm:pr-6 w-full sm:w-auto">
              <div className="p-3 rounded-full shrink-0 bg-primary/10 text-primary">
                <Percent className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">هامش الربح الصافي</p>
                <p className="text-2xl font-bold">
                  {project.totalReceived > 0 
                    ? `${((project.balance / project.totalReceived) * 100).toFixed(1)}%` 
                    : '0%'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {project.currentUserRole !== 'viewer' && (
        <div className={`grid ${project.currentUserRole === 'site_manager' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-4 print:hidden`}>
          {project.currentUserRole !== 'site_manager' && (
            <Button size="lg" variant="success" className="h-14 text-base shadow-sm" onClick={() => openTransactionDialog("deposit")}>
              <ArrowDownRight className="ml-2 h-5 w-5" />
              تسجيل دفعة مستلمة
            </Button>
          )}
          <Button size="lg" variant="destructive" className="h-14 text-base shadow-sm" onClick={() => openTransactionDialog("expense")}>
            <ArrowUpRight className="ml-2 h-5 w-5" />
            تسجيل مصروف
          </Button>
        </div>
      )}

      <Tabs defaultValue="transactions" className="mt-8 space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden border-b rounded-none h-auto p-0 bg-transparent gap-6 print:hidden">
          <TabsTrigger value="transactions" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 shadow-none">سجل الحركات</TabsTrigger>
          <TabsTrigger value="gallery" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 shadow-none">معرض الصور</TabsTrigger>
          {project.currentUserRole !== 'site_manager' && (
            <>
              <TabsTrigger value="recurring" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 shadow-none">مصاريف دورية</TabsTrigger>
              <TabsTrigger value="change-orders" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 shadow-none">أوامر التغيير</TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 shadow-none">سجل النشاط</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="transactions" className="space-y-6 m-0">
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
            {project.currentUserRole !== 'site_manager' && <SelectItem value="deposit">الدفعات المستلمة فقط</SelectItem>}
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
                      {(tx as any).vendorId && <span className="opacity-75 truncate max-w-[100px] sm:max-w-none text-primary font-semibold">• 👤 {vendors.find((v: any) => v.id === (tx as any).vendorId)?.name || 'مورد'}</span>}
                      {tx.personName && !((tx as any).vendorId) && <span className="opacity-75 truncate max-w-[100px] sm:max-w-none">• 👤 {tx.personName}</span>}
                      {tx.type === 'expense' && (tx as any).category && (tx as any).category !== 'others' && (
                        <span className="opacity-100 mr-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                          {CATEGORY_LABELS[(tx as any).category] || (tx as any).category}
                        </span>
                      )}
                      {(tx as any).latitude && (tx as any).longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${(tx as any).latitude},${(tx as any).longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-primary hover:underline whitespace-nowrap"
                          title="عرض الموقع على الخريطة"
                        >
                          <MapPin className="h-3 w-3" />
                          <span className="text-[10px]">الموقع</span>
                        </a>
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
                      {(tx as any).receiptPaths && (tx as any).receiptPaths.length > 0 ? (
                        (tx as any).receiptPaths.map((path: string, idx: number) => (
                          <Button key={idx} variant="outline" size="sm" className="h-8 gap-1.5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary" onClick={() => viewReceipt(path)} title={`عرض المرفق ${idx + 1}`}>
                            <ImageIcon className="h-3.5 w-3.5" />
                            <span className="text-xs">المرفق {idx + 1}</span>
                          </Button>
                        ))
                      ) : tx.receiptPath ? (
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary" onClick={() => viewReceipt(tx.receiptPath!)} title="عرض المرفق">
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span className="text-xs">عرض المرفق</span>
                        </Button>
                      ) : null}
                    {project.currentUserRole !== 'viewer' && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => {
                          const t = tx.transportCost || 0;
                          const l = tx.laborCost || 0;
                          const dv = tx.deductionValue || 0;
                          const isPerc = tx.deductionType !== 'amount';
                          const baseAmount = isPerc ? ((tx.amount - t - l) / (1 + (dv / 100))) : (tx.amount - t - l - dv);
                          const roundedBaseAmount = Math.round(baseAmount * 100) / 100;
                          
                          openTransactionDialog(tx.type, tx.id, {
                            type: tx.type,
                            amount: roundedBaseAmount,
                            description: tx.description,
                            date: tx.date.split('T')[0],
                            shopName: tx.shopName || "",
                            vendorId: (tx as any).vendorId || "",
                            personName: tx.personName || "",
                            category: (tx as any).category || "others",
                            paymentMethod: tx.paymentMethod || "cash",
                            deductionType: tx.deductionType || "percentage",
                            deductionValue: tx.deductionValue || "",
                            deductionReason: tx.deductionReason || "",
                            transportCost: tx.transportCost || "",
                            laborCost: tx.laborCost || "",
                            receiptPath: tx.receiptPath || undefined,
                            receiptPaths: (tx as any).receiptPaths || [],
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
      </TabsContent>

      <TabsContent value="gallery" className="mt-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold">صور الموقع</h3>
          <Button onClick={() => setPhotoDialogOpen(true)} variant="outline">
            <Camera className="mr-2 h-4 w-4" />
            إضافة صورة
          </Button>
        </div>
        
        {isLoadingPhotos ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : !photos || (photos as any[]).length === 0 ? (
          <div className="text-center p-10 border border-dashed rounded-xl text-muted-foreground bg-muted/20">
            لا توجد صور مضافة للمشروع.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(photos as any[]).map((photo) => (
              <Card key={photo.id} className="overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all" onClick={() => viewReceipt(photo.photoPath)}>
                <div className="aspect-square bg-muted relative">
                  <img 
                    src={photo.photoPath.startsWith('http') ? photo.photoPath : `/api/storage${photo.photoPath}`} 
                    alt={photo.caption || 'صورة'} 
                    className="object-cover w-full h-full"
                  />
                </div>
                <CardContent className="p-3">
                  {photo.caption && <p className="text-sm font-medium line-clamp-2 mb-1">{photo.caption}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(photo.takenAt)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      {project.currentUserRole !== 'site_manager' && (
        <TabsContent value="recurring" className="mt-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold">المصاريف الدورية</h3>
            <Button onClick={() => setRecurringDialogOpen(true)} variant="outline">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              إضافة مصروف دوري
            </Button>
          </div>

          {isLoadingRecurring ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : !recurringList || (recurringList as any[]).length === 0 ? (
            <div className="text-center p-10 border border-dashed rounded-xl text-muted-foreground bg-muted/20">
              لا توجد مصاريف دورية مضافة للمشروع.
            </div>
          ) : (
            <div className="space-y-4">
              {(recurringList as any[]).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-card border rounded-lg shadow-sm">
                  <div>
                    <p className="font-bold">{item.description}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      المبلغ: <span className="font-bold text-foreground" dir="ltr">{formatCurrency(item.amount)}</span> • 
                      تكرار: {item.frequency === 'weekly' ? 'أسبوعي' : item.frequency === 'biweekly' ? 'نصف شهري' : 'شهري'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">الموعد القادم: {formatDate(item.nextRunDate)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`active-${item.id}`} className="text-sm">نشط</Label>
                    <Switch 
                      id={`active-${item.id}`}
                      checked={item.isActive} 
                      onCheckedChange={async (checked) => {
                        try {
                          await customFetch(`/api/recurring/${item.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ isActive: checked })
                          });
                          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/recurring`] });
                          toast.success("تم تحديث حالة المصروف الدوري");
                        } catch (e) {
                          toast.error("فشل التحديث");
                        }
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      )}

        {project.currentUserRole !== 'site_manager' && (
          <>
            <TabsContent value="change-orders" className="space-y-4 m-0">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">أوامر التغيير</h3>
                <Button onClick={() => setChangeOrderDialogOpen(true)}>
                  إضافة أمر تغيير
                </Button>
              </div>
              {!changeOrders || (changeOrders as any[]).length === 0 ? (
                <div className="text-center p-10 border border-dashed rounded-xl text-muted-foreground bg-muted/20">
                  لا توجد أوامر تغيير مسجلة.
                </div>
              ) : (
                <div className="space-y-3">
                  {(changeOrders as any[]).map((co) => (
                    <div key={co.id} className="p-4 bg-card border rounded-lg shadow-sm flex flex-col sm:flex-row justify-between gap-4">
                      <div>
                        <p className="font-bold">{co.title}</p>
                        {co.description && <p className="text-sm text-muted-foreground mt-1">{co.description}</p>}
                        <p className="text-xs text-muted-foreground mt-2">{formatDate(co.createdAt)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="font-bold text-lg">{formatCurrency(co.amountChange)}</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${co.status === 'approved' ? 'bg-success/20 text-success' : co.status === 'rejected' ? 'bg-destructive/20 text-destructive' : 'bg-amber-500/20 text-amber-600'}`}>
                          {co.status === 'approved' ? 'موافق عليه' : co.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="activity" className="space-y-4 m-0">
              <h3 className="text-lg font-bold">سجل النشاط</h3>
              {!activities || (activities as any[]).length === 0 ? (
                <div className="text-center p-10 border border-dashed rounded-xl text-muted-foreground bg-muted/20">
                  لا توجد نشاطات مسجلة.
                </div>
              ) : (
                <div className="space-y-4 border-r-2 border-muted pr-4">
                  {(activities as any[]).map((act) => (
                    <div key={act.id} className="relative">
                      <div className="absolute -right-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                      <p className="font-semibold text-sm">{act.action} - {act.entityType}</p>
                      {act.details && <p className="text-xs text-muted-foreground mt-1">{act.details}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{formatDate(act.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Dialogs */}
      <ChangeOrderDialog 
        projectId={projectId} 
        open={changeOrderDialogOpen} 
        onOpenChange={setChangeOrderDialogOpen} 
      />
      <ProjectDialog 
        open={editProjectOpen} 
        onOpenChange={setEditProjectOpen} 
        projectId={projectId}
        defaultValues={{
          name: project.name,
          clientName: project.clientName,
          baseCurrency: project.baseCurrency,
          location: project.location || "",
          budget: project.budget !== null ? Number(project.budget) : undefined,
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

      <PhotoUploadDialog
        projectId={projectId}
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
      />

      <RecurringDialog
        projectId={projectId}
        open={recurringDialogOpen}
        onOpenChange={setRecurringDialogOpen}
      />

      <Dialog open={!!viewingReceipt} onOpenChange={(open) => !open && setViewingReceipt(null)}>
        <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-4 sm:p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle>عرض المرفق</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/30 rounded-md border mt-4 relative">
            {viewingReceipt?.type.startsWith('image/') ? (
              <img src={viewingReceipt.url} alt="Receipt" className="max-w-full max-h-full object-contain" />
            ) : viewingReceipt ? (
              <iframe src={viewingReceipt.url} className="w-full h-full border-0" title="PDF Viewer" />
            ) : null}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => {
              if (viewingReceipt) {
                const a = document.createElement('a');
                a.href = viewingReceipt.url;
                a.download = 'receipt';
                a.click();
              }
            }}>
              <Download className="h-4 w-4 mr-2" />
              تنزيل
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
