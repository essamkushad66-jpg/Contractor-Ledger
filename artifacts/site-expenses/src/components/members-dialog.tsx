import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListProjectMembers,
  useInviteProjectMember,
  useRemoveProjectMember,
  getListProjectMembersQueryKey,
} from "@workspace/api-client-react";

interface MembersDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserRole: "owner" | "editor" | "viewer";
}

export function MembersDialog({ projectId, open, onOpenChange, currentUserRole }: MembersDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");

  const { data: members, isLoading } = useListProjectMembers(projectId, {
    query: {
      enabled: open,
      queryKey: getListProjectMembersQueryKey(projectId)
    }
  });

  const inviteMutation = useInviteProjectMember();
  const removeMutation = useRemoveProjectMember();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      await inviteMutation.mutateAsync({
        id: projectId,
        data: { email, role }
      });
      toast({
        title: "تمت إضافة العضو",
        description: "تمت إضافة العضو إلى المشروع بنجاح",
      });
      setEmail("");
      queryClient.invalidateQueries({ queryKey: getListProjectMembersQueryKey(projectId) });
    } catch (err: any) {
      toast({
        title: "خطأ في الإضافة",
        description: err.response?.data?.error || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeMutation.mutateAsync({
        id: projectId,
        userId
      });
      toast({
        title: "تم حذف العضو",
        description: "تمت إزالة العضو من المشروع",
      });
      queryClient.invalidateQueries({ queryKey: getListProjectMembersQueryKey(projectId) });
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: "لا يمكن حذف العضو",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            مشاركة المشروع
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            يمكنك إضافة أشخاص لمساعدتك في إدارة المشروع أو الإطلاع عليه.
          </p>
        </DialogHeader>

        {currentUserRole === "owner" && (
          <form onSubmit={handleInvite} className="flex flex-col gap-4 mt-4">
            <div className="flex flex-col gap-2">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                placeholder="example@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>الصلاحية</Label>
              <Select value={role} onValueChange={(val: any) => setRole(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">محرر (إضافة وتعديل المصاريف)</SelectItem>
                  <SelectItem value="viewer">مشاهد (إطلاع فقط)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              إرسال دعوة
            </Button>
          </form>
        )}

        <div className="mt-6">
          <h4 className="font-semibold mb-3">الأعضاء الحاليين</h4>
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !members?.length ? (
            <p className="text-sm text-muted-foreground text-center p-4 border rounded-md">
              لا يوجد أعضاء آخرين في هذا المشروع.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <p className="font-medium text-sm">{m.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.role === "editor" ? "محرر" : "مشاهد"}
                    </p>
                  </div>
                  {currentUserRole === "owner" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemove(m.userId)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
