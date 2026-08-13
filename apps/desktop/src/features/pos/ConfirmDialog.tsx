import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLocale } from "@/i18n";

export type ConfirmDetailField = {
  label: string;
  value: string;
};

/** Optional summary card (item / sale) under the prompt. */
export type ConfirmDetailCard = {
  title: string;
  subtitle?: string | null;
  /** Top-right amount or badge (e.g. line total). */
  highlight?: string;
  fields: ConfirmDetailField[];
};

export type ConfirmDialogProps = {
  title: string;
  description: string;
  detailCard?: ConfirmDetailCard;
  /** Soft warning strip under the card (destructive context). */
  warning?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Label after Esc in the modal hint strip. */
  escHint?: string;
  /** Destructive styling; focuses cancel so Enter is safe by default. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra body slot (rare); prefer detailCard + warning. */
  children?: ReactNode;
};

/**
 * Reusable POS confirm — Remove Item / Clear Sale / Cancel Sale.
 * Safe default: destructive dialogs focus Keep… · Enter activates focus ·
 * ←/→ (or ↑/↓) switches actions · Esc cancels.
 * Visual lock: Remove Item Confirm (Batch Q).
 */
export function ConfirmDialog({
  title,
  description,
  detailCard,
  warning,
  confirmLabel,
  cancelLabel,
  escHint,
  destructive = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const { t } = useLocale();
  const resolvedCancelLabel = cancelLabel ?? t("footer.cancel");
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Destructive: focus Keep… so Enter does not wipe the cart by accident.
    const target = destructive ? cancelRef.current : confirmRef.current;
    target?.focus();
  }, [destructive]);

  const focusables = () =>
    [cancelRef.current, confirmRef.current].filter(
      (el): el is HTMLButtonElement => el != null,
    );

  const focusRelative = (delta: number) => {
    const buttons = focusables();
    if (buttons.length === 0) return;
    const active = document.activeElement;
    let idx = buttons.indexOf(active as HTMLButtonElement);
    if (idx < 0) idx = destructive ? 0 : buttons.length - 1;
    const next = (idx + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }

    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      event.stopPropagation();
      const back =
        event.key === "ArrowLeft" || event.key === "ArrowUp";
      focusRelative(back ? -1 : 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      const active = document.activeElement;
      const buttons = focusables();
      const focused = buttons.find((b) => b === active);
      if (focused) {
        event.preventDefault();
        event.stopPropagation();
        focused.click();
        return;
      }
      // Fallback: activate the safe default when focus is elsewhere in the dialog.
      event.preventDefault();
      event.stopPropagation();
      if (destructive) onCancel();
      else onConfirm();
    }
  };

  const escLabel = escHint ?? `${resolvedCancelLabel} / ${t("footer.cancel")}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-900/45 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          onKeyDownCapture={onKeyDownCapture}
          className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl outline-none"
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={
                  destructive
                    ? "flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive text-white"
                    : "flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
                }
                aria-hidden
              >
                <X className="size-4" strokeWidth={2.5} />
              </span>
              <h2
                id={titleId}
                className="text-lg font-bold tracking-tight text-foreground"
              >
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              tabIndex={-1}
              className="rounded-md p-1 text-muted hover:bg-shell hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={t("pos.close")}
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex flex-col gap-3.5 px-5 pt-2 pb-5">
            <p id={descId} className="text-sm leading-relaxed text-muted">
              {description}
            </p>

            {detailCard ? (
              <div className="rounded-lg border border-border bg-canvas/80 px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {detailCard.title}
                    </p>
                    {detailCard.subtitle ? (
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {detailCard.subtitle}
                      </p>
                    ) : null}
                  </div>
                  {detailCard.highlight ? (
                    <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                      {detailCard.highlight}
                    </p>
                  ) : null}
                </div>
                {detailCard.fields.length > 0 ? (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {detailCard.fields.map((field) => (
                      <div key={field.label} className="min-w-0">
                        <dt className="inline text-muted">{field.label}: </dt>
                        <dd className="inline font-semibold text-foreground">
                          {field.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            ) : null}

            {children}

            {warning ? (
              <div
                className="flex gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm"
                role="status"
              >
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                  strokeWidth={2}
                  aria-hidden
                />
                <p className="leading-snug text-destructive">{warning}</p>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-border/80 bg-surface px-5 py-3.5">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="rounded-md border border-primary/45 bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {resolvedCancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              className={
                destructive
                  ? "rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  : "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              }
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Modal-local shortcut strip (mock) — does not alter chrome Footer. */}
      <div className="flex shrink-0 items-center justify-center gap-8 border-t border-black/40 bg-slate-900 px-4 py-2.5 text-xs text-slate-300">
        <span>
          <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-white">
            Enter
          </kbd>{" "}
          {t("confirm.activateFocused")}
        </span>
        <span>
          <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-white">
            ←→
          </kbd>{" "}
          {t("confirm.switchAction")}
        </span>
        <span>
          <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-white">
            Esc
          </kbd>{" "}
          {escLabel}
        </span>
      </div>
    </div>
  );
}
