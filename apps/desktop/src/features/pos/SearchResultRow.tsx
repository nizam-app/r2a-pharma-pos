import { AlertTriangle, Check } from "lucide-react";
import { useLocale, type MessageKey } from "@/i18n";
import { formatTaka } from "@/lib/format";
import {
  daysUntilExpiry,
  formatExpiryShortMonth,
  type PosSearchResult,
} from "@/lib/productSearch";

export type SearchResultRowProps = {
  result: PosSearchResult;
  selected: boolean;
  onHover: () => void;
  onActivate: () => void;
};

/**
 * Search result card — teal PharmaSync chrome (inspired by denser catalog card mock).
 * Unit chips are display-only; Enter still opens Select Batch (sale flow locked).
 * Domain fields (name, generic, manufacturer, strength, form, batch) stay raw.
 */
export function SearchResultRow({
  result,
  selected,
  onHover,
  onActivate,
}: SearchResultRowProps) {
  const { t } = useLocale();
  const expired = result.isExpired;
  const blocked = !result.selectable;
  const price =
    result.sellPerBase != null ? formatTaka(result.sellPerBase) : "—";
  const detailLine = [result.genericName, result.manufacturer]
    .filter(Boolean)
    .join(" · ");

  const unitChip = (u: string): string => {
    if (u === "PIECE") return t("pos.unitPc");
    if (u === "STRIP") return t("pos.unitStripShort");
    if (u === "BOX") return t("pos.unitBoxShort");
    return u;
  };

  return (
    <li role="option" aria-selected={selected} aria-disabled={blocked}>
      <button
        type="button"
        disabled={blocked}
        onMouseEnter={onHover}
        onClick={() => {
          if (!blocked) onActivate();
        }}
        className={[
          "relative flex w-full flex-col gap-2 rounded-lg border bg-surface px-3.5 py-3 text-left transition-colors",
          expired
            ? "cursor-not-allowed border-destructive/30 bg-destructive/5 opacity-90"
            : blocked
              ? "cursor-not-allowed border-border bg-shell/70 opacity-80"
              : selected
                ? "border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                : "border-border hover:border-primary/30 hover:bg-shell/40",
        ].join(" ")}
      >
        {selected && !blocked ? (
          <span
            className="absolute top-0 bottom-0 left-0 w-1 rounded-l-lg bg-primary"
            aria-hidden
          />
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "text-[15px] font-semibold tracking-tight",
                  expired ? "text-destructive" : "text-foreground",
                ].join(" ")}
              >
                {result.name}
              </span>
              {result.strength ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {result.strength}
                </span>
              ) : null}
              {result.form ? (
                <span className="text-xs text-muted">{result.form}</span>
              ) : null}
              {expired ? (
                <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                  {t("pos.expired")}
                </span>
              ) : null}
            </div>
            {detailLine ? (
              <p
                className={[
                  "mt-1 truncate text-xs",
                  expired ? "text-destructive/75" : "text-muted",
                ].join(" ")}
              >
                {detailLine}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 text-right">
            <p
              className={[
                "text-base font-bold tabular-nums",
                expired ? "text-destructive" : "text-foreground",
              ].join(" ")}
            >
              {price}
            </p>
            <p className="text-[11px] text-muted">{t("pos.perPc")}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={[
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
              expired
                ? "border-destructive/40 text-destructive"
                : "border-expiry-ok/40 text-expiry-ok",
            ].join(" ")}
          >
            {expired ? null : (
              <Check className="size-3" strokeWidth={2.5} aria-hidden />
            )}
            {t("pos.stock")} {result.stockPcs} {t("pos.pc")}
          </span>

          {result.fefoBatchNumber ? (
            <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted">
              {t("pos.batch")} {result.fefoBatchNumber}
            </span>
          ) : null}

          <ExpiryChip result={result} expired={expired} t={t} />

          {result.unitTypes.length > 0 ? (
            <span className="ml-auto flex flex-wrap items-center gap-1">
              {result.unitTypes.map((u) => (
                <span
                  key={u}
                  className="rounded border border-border bg-shell px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase"
                  title={t("pos.packagingChipTitle")}
                >
                  {unitChip(u)}
                </span>
              ))}
            </span>
          ) : null}
        </div>

        {selected && !blocked ? (
          <p className="text-[11px] font-medium text-primary">
            ⏎ {t("pos.enterToSelectBatch")}
          </p>
        ) : null}
      </button>
    </li>
  );
}

function ExpiryChip({
  result,
  expired,
  t,
}: {
  result: PosSearchResult;
  expired: boolean;
  t: (key: MessageKey) => string;
}) {
  if (!result.fefoExpiryDate) {
    return (
      <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted">
        {t("pos.noBatch")}
      </span>
    );
  }

  const label = formatExpiryShortMonth(result.fefoExpiryDate);
  const days = daysUntilExpiry(result.fefoExpiryDate);

  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
        <AlertTriangle className="size-3" aria-hidden />
        {t("pos.expired")} · {label}
      </span>
    );
  }

  // Design lock: yellow ≤90d, green >90d (red ≤30d uses warn chip with days).
  if (days <= 90) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-expiry-warn/50 bg-expiry-warn/10 px-1.5 py-0.5 text-[11px] font-medium text-expiry-warn">
        <AlertTriangle className="size-3" aria-hidden />
        {t("pos.exp")} {label} · {days}
        {t("pos.daysSuffix")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted">
      {t("pos.exp")} {label}
    </span>
  );
}
