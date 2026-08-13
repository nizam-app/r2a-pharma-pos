import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export type PosToastTone = "success" | "error" | "info";

export type PosToastProps = {
  message: string;
  onDismiss: () => void;
  /** Auto-hide ms; default 3600. */
  durationMs?: number;
  /** Visual tone — default success (teal pill). */
  tone?: PosToastTone;
};

const TONE_CLASS: Record<PosToastTone, string> = {
  success: "bg-primary text-primary-foreground",
  error: "bg-destructive text-white",
  info: "bg-slate-800 text-white",
};

/**
 * POS toast — teal (or tone) pill, top-center of the workspace.
 * Visual lock: loyalty success banner on Active Cart (Batch T).
 */
export function PosToast({
  message,
  onDismiss,
  durationMs = 3600,
  tone = "success",
}: PosToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [onDismiss, durationMs, message, tone]);

  const Icon =
    tone === "error" ? AlertCircle : tone === "info" ? Info : CheckCircle2;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-14 z-[60] flex justify-center px-4"
    >
      <div
        className={[
          "pointer-events-auto inline-flex max-w-[min(36rem,calc(100vw-2rem))] items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium shadow-md",
          TONE_CLASS[tone],
        ].join(" ")}
      >
        <Icon className="size-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
        <p className="leading-snug">{message}</p>
      </div>
    </div>
  );
}
