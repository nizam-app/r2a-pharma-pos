import { Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  fetchOwnerInventory,
  type OwnerInventoryRow,
} from "@/lib/ownerInventory";

/**
 * Header Receive Stock: pick a product, then go to `/inventory/:id/receive`.
 */
export function ReceiveProductPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (productId: string) => void;
}) {
  const { t } = useLocale();
  const titleId = useId();
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<OwnerInventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setInput("");
      setQ("");
      setRows([]);
      setError(null);
      return;
    }
    const handle = window.setTimeout(() => setQ(input.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [input, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchOwnerInventory({ q: q || undefined, tab: "all", limit: 8, offset: 0 })
      .then((result) => {
        if (cancelled) return;
        setRows(result.items);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRows([]);
        setLoading(false);
        if (err instanceof ApiError) setError(err.message);
        else setError(t("inventory.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [open, q, t]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-xl border border-border bg-surface p-4 shadow-lg"
      >
        <h2 id={titleId} className="text-base font-semibold text-foreground">
          {t("inventory.picker.title")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("inventory.picker.hint")}</p>
        <label className="relative mt-3 block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
            strokeWidth={1.75}
          />
          <span className="sr-only">{t("inventory.search")}</span>
          <input
            type="search"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("inventory.searchPlaceholder")}
            className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted"
          />
        </label>
        <div className="mt-3 max-h-64 overflow-auto">
          {loading ? (
            <p className="px-1 py-3 text-sm text-muted">{t("inventory.loading")}</p>
          ) : null}
          {error ? (
            <p className="px-1 py-3 text-sm text-destructive">{error}</p>
          ) : null}
          {!loading && !error && rows.length === 0 ? (
            <p className="px-1 py-3 text-sm text-muted">
              {t("inventory.picker.empty")}
            </p>
          ) : null}
          <ul>
            {rows.map((row) => (
              <li key={row.productId}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start rounded-md px-2 py-2 text-left hover:bg-canvas"
                  onClick={() => onPick(row.productId)}
                >
                  <span className="text-sm font-medium text-foreground">
                    {row.name}
                  </span>
                  {row.genericName ? (
                    <span className="text-xs text-muted">{row.genericName}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-canvas"
            onClick={onClose}
          >
            {t("inventory.picker.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
