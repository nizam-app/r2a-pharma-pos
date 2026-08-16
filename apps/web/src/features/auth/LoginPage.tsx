import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { LocaleToggle, useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { OwnerOnlyError } from "./ownerGate";

/** Seed owner — matches `packages/database` seed defaults (dev only). */
const DEMO_OWNER = {
  email: "owner@demo.local",
  password: "ChangeMe123!",
  tenantSlug: "demo-pharmacy",
};

/**
 * Invented Owner Login (M6 Batch A) — PharmaSync Admin Portal family.
 * Teal / light grey canvas. No sidebar. Not POS chrome.
 */
export function LoginPage() {
  const { login } = useAuth();
  const { t } = useLocale();
  const emailId = useId();
  const passwordId = useId();
  const tenantId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");
  const [showTenant, setShowTenant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function attemptLogin(input: {
    email: string;
    password: string;
    tenantSlug?: string;
  }) {
    setError(null);
    setSubmitting(true);
    try {
      await login({
        email: input.email.trim(),
        password: input.password,
        ...(input.tenantSlug?.trim()
          ? { tenantSlug: input.tenantSlug.trim() }
          : {}),
      });
    } catch (err) {
      if (err instanceof OwnerOnlyError) {
        setError(t("auth.ownerOnly"));
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("auth.signInFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await attemptLogin({
      email,
      password,
      tenantSlug: tenantSlug.trim() || undefined,
    });
  }

  async function onDemoAdminLogin() {
    setEmail(DEMO_OWNER.email);
    setPassword(DEMO_OWNER.password);
    setTenantSlug(DEMO_OWNER.tenantSlug);
    setShowTenant(true);
    await attemptLogin({
      email: DEMO_OWNER.email,
      password: DEMO_OWNER.password,
      tenantSlug: DEMO_OWNER.tenantSlug,
    });
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-auto bg-canvas">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--r2a-primary) 18%, transparent), transparent 55%), linear-gradient(180deg, var(--r2a-shell) 0%, var(--r2a-canvas) 45%, var(--r2a-canvas) 100%)",
        }}
      />

      <div className="relative z-10 flex items-center justify-end px-6 py-4">
        <LocaleToggle />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-10">
        <div className="mb-8 text-center">
          <p className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            {t("brand.name")}
          </p>
          <p className="mt-2 text-sm text-muted">{t("auth.signInSubtitle")}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm border border-border bg-surface px-6 py-6 shadow-sm"
          noValidate
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor={emailId}
                className="block text-xs font-medium uppercase tracking-wide text-muted"
              >
                {t("auth.email")}
              </label>
              <input
                id={emailId}
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="owner@demo.local"
                disabled={submitting}
              />
            </div>

            <div>
              <label
                htmlFor={passwordId}
                className="block text-xs font-medium uppercase tracking-wide text-muted"
              >
                {t("auth.password")}
              </label>
              <div className="relative mt-1.5">
                <input
                  id={passwordId}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-border bg-canvas py-2 pl-3 pr-10 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="••••••••"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted hover:text-foreground disabled:opacity-50"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword
                      ? t("auth.hidePassword")
                      : t("auth.showPassword")
                  }
                  aria-pressed={showPassword}
                  disabled={submitting}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="size-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {showTenant ? (
              <div>
                <label
                  htmlFor={tenantId}
                  className="block text-xs font-medium uppercase tracking-wide text-muted"
                >
                  {t("auth.tenantSlug")}
                </label>
                <input
                  id={tenantId}
                  name="tenantSlug"
                  type="text"
                  autoComplete="organization"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  className="mt-1.5 w-full border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="demo-pharmacy"
                  disabled={submitting}
                />
              </div>
            ) : (
              <button
                type="button"
                className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => setShowTenant(true)}
              >
                {t("auth.needTenantSlug")}
              </button>
            )}
          </div>

          {error ? (
            <p
              className="mt-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t("auth.signingIn") : t("auth.signIn")}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              void onDemoAdminLogin();
            }}
            className="mt-3 w-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("auth.demoAdmin")}
          </button>
        </form>

        <p className="mt-6 max-w-sm text-center text-xs text-muted">
          {t("auth.apiFooterPrefix")}{" "}
          <code className="text-foreground/80">VITE_API_BASE_URL</code>
          {t("auth.apiFooterSuffix")}
        </p>
      </div>
    </div>
  );
}
