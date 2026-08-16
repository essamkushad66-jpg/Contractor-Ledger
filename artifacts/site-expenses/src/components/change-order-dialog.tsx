import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customFetch } from "@workspace/api-client-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export function ChangeOrderDialog({ 
  open, 
  onOpenChange, 
  projectId 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  projectId: number;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amountChange, setAmountChange] = useState("");
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amountChange) {
      toast.error("يرجى تعبئة الحقول المطلوبة");
      return;
    }

    setIsPending(true);
    try {
      await customFetch(`/api/projects/${projectId}/change-orders`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          amountChange: Number(amountChange),
        })
      });
      toast.success("تمت إضافة أمر التغيير بنجاح");
      queryClient.invalidateQueries({ queryKey: ["change-orders", projectId] });
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setAmountChange("");
    } catch (err: any) {
      toast.error("فشل إضافة أمر التغيير");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة أمر تغيير</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>العنوان</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>الوصف</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>قيمة التغيير</Label>
            <Input type="number" step="0.01" value={amountChange} onChange={e => setAmountChange(e.target.value)} required />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
