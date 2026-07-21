import { useState, useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState("");
  
  useEffect(() => {
    
    const checkLock = () => {
      const currentSavedPin = localStorage.getItem("app_pin");
      const currentUnlocked = sessionStorage.getItem("app_unlocked") === "true";
      if (currentSavedPin && !currentUnlocked) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
    };

    checkLock();

    // Listen for storage events (e.g. locking from another tab)
    window.addEventListener("storage", checkLock);
    return () => window.removeEventListener("storage", checkLock);
  }, []);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      const savedPin = localStorage.getItem("app_pin");
      const currentUnlocked = sessionStorage.getItem("app_unlocked") === "true";
      if (!savedPin || !currentUnlocked) return;

      const timeoutMins = parseInt(localStorage.getItem("app_pin_timeout") || "15", 10);
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        sessionStorage.removeItem("app_unlocked");
        window.dispatchEvent(new Event("storage"));
        toast.info("تم قفل التطبيق تلقائياً بسبب عدم النشاط");
      }, timeoutMins * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [isLocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const savedPin = localStorage.getItem("app_pin");
    if (pin === savedPin) {
      sessionStorage.setItem("app_unlocked", "true");
      setIsLocked(false);
      setPin("");
    } else {
      toast.error("رمز غير صحيح");
      setPin("");
    }
  };

  if (isLocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background text-foreground" dir="rtl">
        <div className="max-w-xs w-full px-6 py-8 text-center flex flex-col items-center">
          <div className="bg-primary/10 p-4 rounded-full mb-6">
            <Lock className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">التطبيق مقفل</h2>
          <p className="text-muted-foreground mb-8 text-sm">أدخل رمز الحماية الخاص بك للمتابعة</p>
          
          <form onSubmit={handleUnlock} className="w-full">
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="text-center text-2xl tracking-widest py-6 mb-4 font-black bg-muted/50 border-2 focus-visible:border-primary"
              autoFocus
              placeholder="••••"
            />
            <Button type="submit" size="lg" className="w-full h-12 text-lg">إلغاء القفل</Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function PinSettingsDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [timeoutMins, setTimeoutMins] = useState("15");

  useEffect(() => {
    if (open) {
      setHasPin(!!localStorage.getItem("app_pin"));
      setTimeoutMins(localStorage.getItem("app_pin_timeout") || "15");
      setCurrentPin("");
      setNewPin("");
    }
  }, [open]);

  const handleSave = () => {
    const savedPin = localStorage.getItem("app_pin");
    
    if (hasPin) {
      if (currentPin !== savedPin) {
        toast.error("الرمز الحالي غير صحيح");
        return;
      }
      if (!newPin) {
        // Remove PIN
        localStorage.removeItem("app_pin");
        sessionStorage.removeItem("app_unlocked");
        toast.success("تم إزالة رمز الحماية");
        onOpenChange(false);
        // Dispatch storage event so AppLockProvider updates immediately if needed
        window.dispatchEvent(new Event("storage"));
        return;
      }
    }
    
    if (newPin.length < 4) {
      toast.error("يجب أن يتكون الرمز من 4 أرقام على الأقل");
      return;
    }
    
    localStorage.setItem("app_pin", newPin);
    localStorage.setItem("app_pin_timeout", timeoutMins);
    sessionStorage.setItem("app_unlocked", "true");
    toast.success("تم تعيين رمز الحماية بنجاح");
    window.dispatchEvent(new Event("storage"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>إعدادات قفل التطبيق</DialogTitle>
          <p className="text-sm text-muted-foreground">
            قم بتعيين رمز حماية (PIN) لقفل التطبيق محلياً على هذا الجهاز. سيتم قفل التطبيق تلقائياً عند إغلاق المتصفح.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasPin && (
            <div className="space-y-2">
              <label className="text-sm font-medium">الرمز الحالي</label>
              <Input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="أدخل الرمز الحالي"
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">{hasPin ? "الرمز الجديد (اتركه فارغاً لإلغاء القفل)" : "رمز الحماية الجديد"}</label>
            <Input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="••••"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">القفل التلقائي (عند عدم النشاط)</label>
            <Select value={timeoutMins} onValueChange={setTimeoutMins}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المدة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">دقيقة واحدة</SelectItem>
                <SelectItem value="5">5 دقائق</SelectItem>
                <SelectItem value="15">15 دقيقة</SelectItem>
                <SelectItem value="30">30 دقيقة</SelectItem>
                <SelectItem value="60">ساعة واحدة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave}>حفظ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
