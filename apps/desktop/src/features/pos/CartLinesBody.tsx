import { AlertTriangle, Minus, Pencil, Plus } from "lucide-react";
import { useLocale } from "@/i18n";
import { formatTaka } from "@/lib/format";
import {
  daysUntilExpiry,
  formatExpiryShortMonth,
} from "@/lib/productSearch";
import type { CartLine } from "./cartTypes";

export type CartLinesBodyProps = {
  lines: CartLine[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onEdit: (line: CartLine) => void;
  onChangeQty: (lineId: string, nextQty: number) => void;
};

/**
 * Active Cart table — dense rows; Edit pencil kept; Del opens Remove Item confirm.
 */
export function CartLinesBody({
  lines,
  selectedIndex,
  onSelectIndex,
  onEdit,
  onChangeQty,
}: CartLinesBodyProps) {
  const { t } = useLocale();
  if (lines.length === 0) return null;

  const unitsDispensed = lines.reduce((sum, line) => sum + line.quantityBase, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[42rem] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-shell text-[10px] font-semibold tracking-wide text-muted uppercase">
            <tr className="border-b border-border">
              <th className="px-2 py-2 font-semibold">{t("cartLines.item")}</th>
              <th className="px-2 py-2 font-semibold">{t("cartLines.unit")}</th>
              <th className="px-2 py-2 font-semibold">{t("cartLines.batch")}</th>
              <th className="px-2 py-2 font-semibold">{t("cartLines.expiry")}</th>
              <th className="px-2 py-2 text-center font-semibold">
                {t("cartLines.qty")}
              </th>
              <th className="px-2 py-2 text-right font-semibold">
                {t("cartLines.unitPrice")}
              </th>
              <th className="px-2 py-2 text-right font-semibold">
                {t("cartLines.disc")}
              </th>
              <th className="px-2 py-2 text-right font-semibold">
                {t("cartLines.total")}
              </th>
              <th className="px-1 py-2 text-right font-semibold">
                <span className="sr-only">{t("cartLines.edit")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <CartLineRow
                key={line.id}
                line={line}
                selected={index === selectedIndex}
                onSelect={() => onSelectIndex(index)}
                onEdit={() => onEdit(line)}
                onChangeQty={(qty) => onChangeQty(line.id, qty)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-1 pt-2 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-shell px-1 py-px font-medium">
            ↑↓
          </kbd>
          {t("pos.select")}
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-shell px-1 py-px font-medium">
            +/−
          </kbd>
          {t("pos.quantity")}
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-shell px-1 py-px font-medium">
            Del
          </kbd>
          {t("remove.confirm")}
        </span>
        <span className="ml-auto tabular-nums font-medium text-foreground/80">
          {unitsDispensed} {t("cartLines.unitsDispensed")}
        </span>
      </div>
    </div>
  );
}

function CartLineRow({
  line,
  selected,
  onSelect,
  onEdit,
  onChangeQty,
}: {
  line: CartLine;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onChangeQty: (qty: number) => void;
}) {
  const { t } = useLocale();
  const days = daysUntilExpiry(line.expiryDate);
  const expLabel = formatExpiryShortMonth(line.expiryDate);
  const warn = days <= 90;
  const danger = days <= 30;
  const unitBadge =
    line.unitType === "PIECE"
      ? t("pos.unitPc")
      : line.unitType === "STRIP"
        ? t("pos.unitStripShort")
        : t("pos.unitBoxShort");

  return (
    <tr
      onClick={onSelect}
      className={
        selected
          ? "border-b border-border/80 align-middle bg-primary/5 ring-1 ring-inset ring-primary/30"
          : "border-b border-border/80 align-middle hover:bg-canvas/80"
      }
      aria-selected={selected}
    >
      <td className="max-w-[14rem] px-2 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold text-foreground">
            {line.productName}
          </span>
          {line.strength ? (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {line.strength}
            </span>
          ) : null}
          {line.form ? (
            <span className="text-[11px] text-muted">{line.form}</span>
          ) : null}
        </div>
        {line.genericName ? (
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {line.genericName}
          </p>
        ) : null}
      </td>

      <td className="px-2 py-2.5">
        <span className="inline-flex rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-foreground">
          {unitBadge}
        </span>
      </td>

      <td className="px-2 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            title={t("cartLines.editBatchPackaging")}
          >
            {line.batchNumber}
          </button>
          {line.fefoOverride ? (
            <span
              className="inline-flex items-center rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent uppercase"
              title={`${t("cartLines.overrideTitle")} ${line.fefoOverride.authorizedByName}`}
            >
              {t("cartLines.override")}
            </span>
          ) : null}
        </div>
      </td>

      <td className="px-2 py-2.5">
        {warn ? (
          <span
            className={
              danger
                ? "inline-flex items-center gap-1 rounded-md border border-expiry-danger/40 bg-expiry-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-expiry-danger"
                : "inline-flex items-center gap-1 rounded-md border border-expiry-warn/40 bg-expiry-warn/10 px-1.5 py-0.5 text-[10px] font-semibold text-expiry-warn"
            }
          >
            <AlertTriangle className="size-3 shrink-0" strokeWidth={2} aria-hidden />
            {expLabel} · {days}d
          </span>
        ) : (
          <span className="inline-flex rounded-md border border-border bg-shell px-1.5 py-0.5 text-[10px] font-medium text-muted">
            {expLabel}
          </span>
        )}
      </td>

      <td className="px-2 py-2.5">
        <div
          className="mx-auto flex w-fit items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label={t("pos.decreaseQty")}
            disabled={line.unitQty <= 1}
            onClick={() => onChangeQty(line.unitQty - 1)}
            className="flex size-6 items-center justify-center rounded border border-border bg-surface text-muted hover:bg-shell disabled:opacity-40"
          >
            <Minus className="size-3" strokeWidth={2} />
          </button>
          <input
            type="number"
            min={1}
            max={line.maxUnitQty}
            value={line.unitQty}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onChangeQty(Math.trunc(n));
            }}
            className="h-6 w-9 rounded border border-border bg-surface text-center text-xs font-semibold tabular-nums text-foreground outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40"
            aria-label={`${t("pos.quantity")} ${line.productName}`}
          />
          <button
            type="button"
            aria-label={t("pos.increaseQty")}
            disabled={line.unitQty >= line.maxUnitQty}
            onClick={() => onChangeQty(line.unitQty + 1)}
            className="flex size-6 items-center justify-center rounded border border-border bg-surface text-muted hover:bg-shell disabled:opacity-40"
          >
            <Plus className="size-3" strokeWidth={2} />
          </button>
        </div>
      </td>

      <td className="px-2 py-2.5 text-right text-xs tabular-nums text-foreground">
        {formatTaka(line.unitPrice)}
      </td>

      <td className="px-2 py-2.5 text-right text-xs text-muted">—</td>

      <td className="px-2 py-2.5 text-right text-sm font-bold tabular-nums text-foreground">
        {formatTaka(line.lineTotal)}
      </td>

      <td className="px-1 py-2.5">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded p-1 text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={`${t("cartLines.edit")} ${line.productName}`}
            title={t("cartLines.edit")}
          >
            <Pencil className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
}
