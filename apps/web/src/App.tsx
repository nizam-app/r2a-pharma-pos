import { AuthProvider, LoginPage, useAuth } from "@/features/auth";
import { AppShell } from "@/features/shell";
import { LocaleProvider, useLocale } from "@/i18n";
import { OwnerPathProvider } from "@/lib/OwnerPathProvider";
import { TenantContextProvider } from "@/lib/TenantContextProvider";

/**
 * M6 Batch B — Owner chrome (sidebar + header).
 * Dashboard KPIs are Batch G. Sales tables are later batches.
 */
export default function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <AppGate />
      </AuthProvider>
    </LocaleProvider>
  );
}

function AppGate() {
  const { status } = useAuth();
  const { t } = useLocale();

  if (status === "loading") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 bg-canvas px-6 text-center">
        <p className="text-lg font-semibold text-primary">{t("brand.name")}</p>
        <p className="text-sm text-muted">{t("auth.restoringSession")}</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LoginPage />;
  }

  return (
    <OwnerPathProvider>
      <TenantContextProvider>
        <AppShell />
      </TenantContextProvider>
    </OwnerPathProvider>
  );
}
