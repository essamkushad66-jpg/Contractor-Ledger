import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { requestUploadUrl, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Camera, X } from "lucide-react";
import { toast } from "sonner";

const photoSchema = z.object({
  caption: z.string().optional(),
  takenAt: z.string().min(1, "التاريخ مطلوب"),
});

type PhotoFormData = z.infer<typeof photoSchema>;

export function PhotoUploadDialog({
  projectId,
  open,
  onOpenChange
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<PhotoFormData>({
    resolver: zodResolver(photoSchema),
    defaultValues: {
      caption: "",
      takenAt: (() => {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      })(),
    }
  });

  const onSubmit = async (values: PhotoFormData) => {
    if (!file) {
      toast.error("يرجى اختيار صورة أولاً");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Get upload URL
      const res = await requestUploadUrl({
        name: file.name,
        size: file.size,
        contentType: file.type
      });

      if (!res.uploadURL) {
        throw new Error("No upload URL returned");
      }

      // 2. Upload to R2
      const uploadRes = await fetch(res.uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type }
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload to storage");
      }

      // 3. Save to database
      await customFetch(`/api/projects/${projectId}/photos`, {
        method: "POST",
        body: JSON.stringify({
          photoPath: res.objectPath,
          caption: values.caption,
          takenAt: values.takenAt
        })
      });

      toast.success("تم رفع الصورة بنجاح");
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] });
      
      // Reset and close
      setFile(null);
      form.reset();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء رفع الصورة");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && !isUploading) {
        setFile(null);
        form.reset();
        onOpenChange(false);
      } else if (val) {
        onOpenChange(true);
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>إضافة صورة جديدة</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>الصورة</Label>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setFile(e.target.files[0]);
                }
              }}
            />
            
            {file ? (
              <div className="flex items-center justify-between p-2 border rounded bg-muted/50">
                <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button 
                type="button" 
                variant="outline" 
                className="w-full border-dashed h-20"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="mr-2 h-6 w-6" />
                اختر صورة
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label>الوصف (اختياري)</Label>
            <Input {...form.register("caption")} placeholder="مثال: واجهة المبنى بعد التشطيب" />
          </div>

          <div className="space-y-2">
            <Label>تاريخ الالتقاط</Label>
            <Input type="date" {...form.register("takenAt")} />
            {form.formState.errors.takenAt && <p className="text-sm text-destructive">{form.formState.errors.takenAt.message}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>إلغاء</Button>
            <Button type="submit" disabled={isUploading || !file}>
              {isUploading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {isUploading ? "جاري الرفع..." : "حفظ الصورة"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
