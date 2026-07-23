import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Route, Switch, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { ClerkProvider, Show, useClerk, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import Dashboard from '@/pages/dashboard';
import ProjectDetails from '@/pages/project-details';
import Landing from '@/pages/landing';
import SignInPage from '@/pages/sign-in';
import SignUpPage from '@/pages/sign-up';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import PrintProject from '@/pages/print-project';
import { AppLockProvider, PinSettingsDialog } from '@/components/pin-lock';
import { Lock } from 'lucide-react';

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains. Do not inline the env var, leave
// publishableKey undefined, or replace publishableKeyFromHost with anything else.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev (Clerk hits dev FAPI directly), auto-set
// in prod. Do NOT gate on import.meta.env.PROD / NODE_ENV — the empty dev value
// is intentional, and any branching breaks the prod proxy.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(215 100% 40%)',
    colorForeground: 'hsl(222 47% 11%)',
    colorMutedForeground: 'hsl(215 16% 47%)',
    colorDanger: 'hsl(348 80% 45%)',
    colorBackground: 'hsl(0 0% 100%)',
    colorInput: 'hsl(0 0% 100%)',
    colorInputForeground: 'hsl(222 47% 11%)',
    colorNeutral: 'hsl(214 32% 91%)',
    fontFamily: "'Cairo', sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-border',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-foreground font-extrabold text-xl',
    headerSubtitle: 'text-muted-foreground',
    socialButtonsBlockButtonText: 'text-foreground font-medium',
    formFieldLabel: 'text-foreground font-medium',
    footerActionLink: 'text-primary font-semibold',
    footerActionText: 'text-muted-foreground',
    dividerText: 'text-muted-foreground',
    identityPreviewEditButton: 'text-primary',
    formFieldSuccessText: 'text-success',
    alertText: 'text-destructive',
    logoBox: 'flex justify-center mb-2',
    logoImage: 'h-10 w-10 rounded-xl',
    socialButtonsBlockButton: 'border border-border hover:bg-accent',
    formButtonPrimary: 'bg-primary hover:bg-primary/90 text-primary-foreground font-semibold',
    formFieldInput: 'border border-input bg-background text-foreground',
    footerAction: 'text-sm',
    dividerLine: 'bg-border',
    alert: 'border border-destructive/30 bg-destructive/5',
    otpCodeFieldInput: 'border border-input',
    formFieldRow: 'gap-1.5',
    main: 'gap-4',
  },
};

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function AuthedDashboard() {
  return (
    <>
      <Show when="signed-in">
        <div className="max-w-3xl mx-auto p-4 md:p-6 pb-20">
          <Dashboard />
        </div>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function AuthedProjectDetails() {
  return (
    <>
      <Show when="signed-in">
        <div className="max-w-3xl mx-auto p-4 md:p-6 pb-20">
          <ProjectDetails />
        </div>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function AuthedPrintProject() {
  return (
    <>
      <Show when="signed-in">
        <PrintProject />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function LogoutButton() {
  const { signOut } = useClerk();
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectUrl: basePath || '/' })}
      className="text-xs font-medium opacity-80 hover:opacity-100 px-2 py-1 rounded-md bg-primary-foreground/10 border border-primary-foreground/20 transition-opacity"
    >
      تسجيل الخروج
    </button>
  );
}

import { setAuthTokenGetter } from '@workspace/api-client-react';

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/dashboard" component={AuthedDashboard} />
      <Route path="/projects/:id" component={AuthedProjectDetails} />
      <Route path="/projects/:id/print" component={AuthedPrintProject} />
      <Route>
        <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-4">
          <div className="text-4xl font-black text-muted">404</div>
          <p>الصفحة غير موجودة</p>
        </div>
      </Route>
    </Switch>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const [pinSettingsOpen, setPinSettingsOpen] = useState(false);
  const location = window.location.pathname;
  
  const handleManualLock = () => {
    if (localStorage.getItem("app_pin")) {
      sessionStorage.removeItem("app_unlocked");
      window.dispatchEvent(new Event("storage"));
    } else {
      setPinSettingsOpen(true);
    }
  };

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'مرحباً بعودتك',
            subtitle: 'سجّل دخولك لمتابعة مشاريعك',
            actionText: 'ليس لديك حساب؟',
            actionLink: 'إنشاء حساب',
          },
        },
        signUp: {
          start: {
            title: 'إنشاء حساب جديد',
            subtitle: 'ابدأ بتسجيل مشاريعك ومصاريفك',
            actionText: 'لديك حساب مسبقاً؟',
            actionLink: 'تسجيل الدخول',
          },
        },
        formFieldLabel__emailAddress: 'البريد الإلكتروني',
        formFieldLabel__password: 'كلمة المرور',
        formFieldInputPlaceholder__emailAddress: 'أدخل بريدك الإلكتروني',
        formFieldInputPlaceholder__password: 'أدخل كلمة المرور',
        formFieldAction__forgotPassword: 'نسيت كلمة المرور؟',
        formButtonPrimary: 'متابعة',
        dividerText: 'أو',
        socialButtonsBlockButton: 'الاستمرار عبر {{provider|titleize}}',
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="contractor-ledger-theme">
          <ClerkQueryClientCacheInvalidator />
          <AppLockProvider>
            <div className="min-h-[100dvh] bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary overflow-x-hidden flex flex-col">
              <Show when="signed-in">
                {!location.includes('/print') && (
                  <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-30 print:hidden">
                    <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
                      <h1 className="text-xl font-bold tracking-tight">إدارة مشاريع البناء</h1>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleManualLock}
                          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-primary-foreground/10 transition-colors"
                          title="قفل التطبيق / إعدادات القفل"
                        >
                          <Lock className="h-4 w-4" />
                        </button>
                        <ThemeToggle />
                        <LogoutButton />
                      </div>
                    </div>
                  </header>
                )}
              </Show>
              <main>
                <Router />
              </main>
            </div>
          </AppLockProvider>
          <PinSettingsDialog open={pinSettingsOpen} onOpenChange={setPinSettingsOpen} />
          <Toaster position="top-center" dir="rtl" />
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
