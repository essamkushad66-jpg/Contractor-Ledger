import { useState } from "react";
import { useListProjects, useGetDashboardSummary } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building2, MapPin, Wallet, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { ProjectDialog } from "@/components/project-dialog";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: projects, isLoading: isLoadingProjects } = useListProjects();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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
              <div className="text-3xl font-bold">{formatCurrency(summary?.totalBalance || 0)}</div>
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
              <div className="text-2xl font-bold text-destructive">{formatCurrency(summary?.totalSpent || 0)}</div>
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
              <div className="text-2xl font-bold text-success">{formatCurrency(summary?.totalReceived || 0)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-4">
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
                {typeof projects === 'string' ? projects.slice(0, 500) : JSON.stringify(projects, null, 2)}
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
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="block transition-transform hover:-translate-y-1 active:scale-95">
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg mb-1">{project.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {project.clientName}
                        </CardDescription>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${project.balance >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
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
                    <div className="flex justify-between text-xs text-muted-foreground mt-4 pt-4 border-t">
                      <span>مصروف: <span className="text-destructive font-medium">{formatCurrency(project.totalSpent)}</span></span>
                      <span>مستلم: <span className="text-success font-medium">{formatCurrency(project.totalReceived)}</span></span>
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
