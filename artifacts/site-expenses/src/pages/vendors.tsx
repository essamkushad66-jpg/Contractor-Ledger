import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { 
  getListVendorsQueryKey, 
  listVendors, 
  createVendor, 
  updateVendor, 
  deleteVendor,
  Vendor
} from "@workspace/api-client-react";
import { Plus, User, Phone, StickyNote, Trash2, Edit, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Vendors() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "worker",
    phone: "",
    notes: ""
  });

  const { data: vendors, isLoading } = useQuery({
    queryKey: getListVendorsQueryKey(),
    queryFn: async () => {
      const res = await listVendors();
      return res.data;
    }
  });

  const createMut = useMutation({
    mutationFn: async (data: typeof formData) => {
      await createVendor(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
      setIsDialogOpen(false);
      toast.success("تم إضافة المورد بنجاح");
      resetForm();
    },
    onError: () => toast.error("حدث خطأ أثناء الإضافة")
  });

  const updateMut = useMutation({
    mutationFn: async (data: { id: number, vendor: typeof formData }) => {
      await updateVendor(data.id, data.vendor);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
      setIsDialogOpen(false);
      toast.success("تم التعديل بنجاح");
      resetForm();
    },
    onError: () => toast.error("حدث خطأ أثناء التعديل")
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await deleteVendor(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
      toast.success("تم الحذف بنجاح");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("الاسم مطلوب");
    if (editingVendor) {
      updateMut.mutate({ id: editingVendor.id, vendor: formData });
    } else {
      createMut.mutate(formData);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", type: "worker", phone: "", notes: "" });
    setEditingVendor(null);
  };

  const handleEdit = (v: Vendor) => {
    setEditingVendor(v);
    setFormData({
      name: v.name,
      type: v.type,
      phone: v.phone || "",
      notes: v.notes || ""
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">سجل الموردين والعمال</h2>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة جديد
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-10 text-muted-foreground">جاري التحميل...</div>
        ) : vendors?.length === 0 ? (
          <div className="col-span-full text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border border-border/50">
            لا يوجد أي موردين أو عمال حالياً
          </div>
        ) : (
          vendors?.map(v => (
            <div key={v.id} className="bg-card text-card-foreground p-4 rounded-xl border shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 font-bold text-lg">
                  <User className="h-5 w-5 text-primary" />
                  {v.name}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(v)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm("هل أنت متأكد من حذف جهة الاتصال؟")) {
                      deleteMut.mutate(v.id);
                    }
                  }} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold">
                    {v.type === 'worker' ? 'عامل / مقاول' : v.type === 'engineer' ? 'مهندس' : v.type === 'supplier' ? 'مورد' : 'أخرى'}
                  </span>
                </div>
                {v.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span dir="ltr">{v.phone}</span>
                  </div>
                )}
                {v.notes && (
                  <div className="flex items-start gap-2">
                    <StickyNote className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{v.notes}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingVendor ? 'تعديل جهة الاتصال' : 'إضافة جهة اتصال جديدة'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">الاسم <span className="text-destructive">*</span></label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="الاسم الكامل أو اسم الشركة" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">النوع</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.type} 
                onChange={e => setFormData({...formData, type: e.target.value})}
              >
                <option value="worker">عامل / مقاول</option>
                <option value="supplier">مورد</option>
                <option value="engineer">مهندس</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">رقم الهاتف (اختياري)</label>
              <Input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="09X XXX XXXX" dir="ltr" className="text-right" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">ملاحظات (اختياري)</label>
              <Input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="أي تفاصيل أخرى..." />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" className="flex-1" disabled={createMut.isPending || updateMut.isPending}>
                حفظ
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
