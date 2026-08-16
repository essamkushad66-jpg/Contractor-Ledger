import { useState, useMemo } from "react";
import { useListProjects, useGetDashboardSummary } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building2, MapPin, Wallet, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { ProjectDialog } from "@/components/project-dialog";

type DateRange = 'this_month' | 'last_3_months' | 'this_year' | 'all';

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: projects, isLoading: isLoadingProjects } = useListProjects();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('all');

  const filteredProjects = useMemo(() => {
    if (!projects || !Array.isArray(projects)) return [];
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLast3Months = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const startOfThisYear = new Date(now.getFullYear(), 0, 1);

    return projects.filter(p => {
      const pDate = new Date(p.createdAt);
      switch (dateRange) {
        case 'this_month': return pDate >= startOfThisMonth;
        case 'last_3_months': return pDate >= startOfLast3Months;
        case 'this_year': return pDate >= startOfThisYear;
        case 'all': default: return true;
      }
    });
  }, [projects, dateRange]);

  const computedSummary = useMemo(() => {
    if (dateRange === 'all' && summary) return summary;
    if (!filteredProjects) return { totalBalance: 0, totalSpent: 0, totalReceived: 0, projectCount: 0 };
    return {
      totalBalance: filteredProjects.reduce((sum, p) => sum + p.balance, 0),
      totalSpent: filteredProjects.reduce((sum, p) => sum + p.totalSpent, 0),
      totalReceived: filteredProjects.reduce((sum, p) => sum + p.totalReceived, 0),
      projectCount: filteredProjects.length
    };
  }, [summary, filteredProjects, dateRange]);

  const monthlyData = useMemo(() => {
    if (!filteredProjects) return [];
    const map = new Map<string, { month: string, income: number, expense: number, dateObj: Date }>();
    
    filteredProjects.forEach(p => {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(key)) {
        map.set(key, {
          month: new Intl.DateTimeFormat('ar-LY', { month: 'short', year: 'numeric' }).format(d),
          income: 0,
          expense: 0,
          dateObj: d,
        });
      }
      const data = map.get(key)!;
      data.income += p.totalReceived;
      data.expense += p.totalSpent;
    });

    return Array.from(map.values()).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [filteredProjects]);

  const profitData = useMemo(() => {
    if (!filteredProjects) return [];
    return filteredProjects.map(p => ({
      name: p.name,
      profit: p.totalReceived - p.totalSpent
    }));
  }, [filteredProjects]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">نظرة عامة</h2>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">إضافة مشروع</span>
          <span className="sm:hidden">مشروع</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={dateRange === 'this_month' ? 'default' : 'outline'} onClick={() => setDateRange('this_month')}>هذا الشهر</Button>
        <Button size="sm" variant={dateRange === 'last_3_months' ? 'default' : 'outline'} onClick={() => setDateRange('last_3_months')}>آخر 3 أشهر</Button>
        <Button size="sm" variant={dateRange === 'this_year' ? 'default' : 'outline'} onClick={() => setDateRange('this_year')}>هذه السنة</Button>
        <Button size="sm" variant={dateRange === 'all' ? 'default' : 'outline'} onClick={() => setDateRange('all')}>الكل</Button>
      </div>

      {isLoadingSummary ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-primary text-primary-foreground border-none shadow-md">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-sm font-medium opacity-90 flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                الرصيد الإجمالي المتبقي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(computedSummary?.totalBalance || 0)}</div>
            </CardContent>
          </Card>
          
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4" />
                إجمالي المصروف
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(computedSummary?.totalSpent || 0)}</div>
            </CardContent>
          </Card>
          
          <Card className="border-success/20 bg-success/5">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-sm font-medium text-success flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" />
                إجمالي المستلم
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(computedSummary?.totalReceived || 0)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoadingProjects && Array.isArray(filteredProjects) && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card className="p-4 pt-6 shadow-sm overflow-x-auto">
            <h3 className="text-lg font-bold mb-6 text-center">التدفق النقدي (حسب شهر الإنشاء)</h3>
            <div className="h-72 min-w-[300px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `${val/1000}k`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="income" name="الدخل (المستلم)" stroke="hsl(var(--success))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="expense" name="المصروف" stroke="hsl(var(--destructive))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4 pt-6 shadow-sm overflow-x-auto">
            <h3 className="text-lg font-bold mb-6 text-center">مقارنة الأرباح للمشاريع</h3>
            <div className="h-72 min-w-[300px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `${val/1000}k`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="profit" name="الربح (المستلم - المصروف)" radius={[4, 4, 0, 0]}>
                    {profitData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-4 mt-8">
        <h3 className="text-xl font-bold">المشاريع الحالية</h3>
        
        {isLoadingProjects ? (
          <div className="flex justify-center p-8 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : !Array.isArray(projects) ? (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-6 text-destructive">
              <h3 className="font-bold mb-2">خطأ في الاتصال بالخادم (API Error)</h3>
              <p>The frontend failed to connect to the backend API properly.</p>
              <p className="mt-2 text-sm font-bold">VITE_API_URL is: {import.meta.env.VITE_API_URL || "NOT SET (UNDEFINED)"}</p>
              <p className="mt-2 text-sm">It received this response instead of data:</p>
              <pre className="mt-4 p-4 bg-background/50 rounded overflow-auto max-h-48 text-xs text-left whitespace-pre-wrap font-mono" dir="ltr">
                {typeof (projects as any) === 'string' ? (projects as any).slice(0, 500) : JSON.stringify(projects, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-10 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2">لا توجد مشاريع بعد</h3>
              <p className="text-muted-foreground max-w-sm mb-4">
                قم بإضافة أول مشروع لتبدأ في تتبع الدفعات والمصاريف الخاصة به بكل سهولة.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>إضافة مشروع جديد</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="block transition-transform hover:-translate-y-1 active:scale-95">
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg mb-1 truncate" title={project.name}>{project.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 truncate" title={project.clientName}>
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{project.clientName}</span>
                        </CardDescription>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs sm:text-sm font-bold shrink-0 whitespace-nowrap ${project.balance >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {formatCurrency(project.balance)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {project.location && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                        <MapPin className="h-3 w-3" />
                        {project.location}
                      </div>
                    )}
                    <div className="flex justify-between text-xs sm:text-sm text-muted-foreground mt-4 pt-4 border-t gap-2">
                      <span className="truncate">مصروف: <span className="text-destructive font-bold">{formatCurrency(project.totalSpent)}</span></span>
                      <span className="truncate">مستلم: <span className="text-success font-bold">{formatCurrency(project.totalReceived)}</span></span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <ProjectDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
