import { useLocale } from "@/i18n";

const APP_VERSION = "v0.1.0-m3";

export type FooterStatus = {
  /** Left status hint while printing / retrying. */
  hint?: string | null;
  /** Right readiness pill — READY or SYSTEM BUSY. */
  readiness?: "ready" | "busy" | null;
};

export type FooterProps = {
  status?: FooterStatus | null;
};

/** Footer shortcut strip — keyboard map from master plan / chrome lock. */
export function Footer({ status = null }: FooterProps) {
  const { t } = useLocale();
  const busy = status?.readiness === "busy";
  const hint = status?.hint?.trim() || null;
  const showReady = status?.readiness === "ready";

  return (
    <footer
      className={[
        "flex shrink-0 items-center justify-between border-t px-4 text-xs",
        busy
          ? "border-border bg-foreground text-white"
          : "border-border bg-shell text-muted",
      ].join(" ")}
      style={{ height: "var(--r2a-footer-height)" }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        {hint ? (
          <span
            className={[
              "inline-flex items-center gap-1.5 font-medium",
              busy ? "text-white" : "text-foreground",
            ].join(" ")}
          >
            {busy ? (
              <span
                className="inline-block size-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden
              />
            ) : null}
            {hint}
          </span>
        ) : (
          <>
            <span>
              <kbd
                className={[
                  "font-medium",
                  busy ? "text-white" : "text-foreground",
                ].join(" ")}
              >
                [F2]
              </kbd>{" "}
              {t("footer.newSale")}
            </span>
            <span>
              <kbd
                className={[
                  "font-medium",
                  busy ? "text-white" : "text-foreground",
                ].join(" ")}
              >
                [Ctrl+K]
              </kbd>{" "}
              {t("footer.search")}
            </span>
            <span>
              <kbd
                className={[
                  "font-medium",
                  busy ? "text-white" : "text-foreground",
                ].join(" ")}
              >
                [F4]
              </kbd>{" "}
              {t("footer.substitutes")}
            </span>
            <span>
              <kbd
                className={[
                  "font-medium",
                  busy ? "text-white" : "text-foreground",
                ].join(" ")}
              >
                [F8]
              </kbd>{" "}
              {t("footer.customer")}
            </span>
            <span>
              <kbd
                className={[
                  "font-medium",
                  busy ? "text-white" : "text-foreground",
                ].join(" ")}
              >
                [F6]
              </kbd>{" "}
              {t("footer.hold")}
            </span>
            <span>
              <kbd
                className={[
                  "font-medium",
                  busy ? "text-white" : "text-foreground",
                ].join(" ")}
              >
                [F7]
              </kbd>{" "}
              {t("footer.heldList")}
            </span>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {!hint ? (
          <span
            className={
              busy ? "font-medium text-red-300" : "font-medium text-destructive"
            }
          >
            <kbd>[Esc]</kbd> {t("footer.cancel")}
          </span>
        ) : null}
        {busy ? (
          <span className="font-bold tracking-wide text-amber-300 uppercase">
            {t("footer.systemBusy")}
          </span>
        ) : showReady ? (
          <span className="font-bold tracking-wide text-primary uppercase">
            {t("footer.ready")}
          </span>
        ) : (
          <span className="tabular-nums text-muted">{APP_VERSION}</span>
        )}
      </div>
    </footer>
  );
}
