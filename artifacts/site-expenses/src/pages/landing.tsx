import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function Landing() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="max-w-3xl mx-auto w-full px-4 md:px-6 py-6 flex items-center gap-3">
        <img src={`${basePath}/logo.svg`} alt="مصاريف المشاريع" className="w-10 h-10 rounded-xl" />
        <span className="text-lg font-bold tracking-tight">مصاريف المشاريع</span>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-3xl mx-auto w-full px-4 md:px-6 py-12 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
            تابع بناءك online
          </h1>
          <p className="mt-4 text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            سجّل كل ما تستلمه من صاحب المشروع، وكل مصروف تصرفه على الحديد والأسمنت والبلك والعمال —
            والتطبيق يحسب لك أوتوماتيكياً الباقي في الجيب لكل مشروع.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link href="/sign-up">
              <Button size="lg" className="min-w-40">
                إنشاء حساب
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="min-w-40">
                تسجيل الدخول
              </Button>
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-right">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-sm font-semibold">مشاريعك الخاصة</div>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                كل حساب يشوف مشاريعه فقط، بعيداً عن أي مقاول آخر يستخدم التطبيق.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-sm font-semibold">الباقي في الجيب</div>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                رصيد كل مشروع يتحدث تلقائياً مع كل دفعة أو مصروف تسجله.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-sm font-semibold">سريع من الموبايل</div>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                مصمم للتسجيل السريع بيد واحدة وأنت في الموقع.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
