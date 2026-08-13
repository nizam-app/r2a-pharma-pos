import { ShoppingCart } from "lucide-react";
import { useLocale } from "@/i18n";

/**
 * Empty Current Sale cart body (Batch G).
 * Frame (header / customer / totals / Proceed) stays in CartPanel chrome.
 */
export function EmptyCartBody() {
  const { t } = useLocale();
  return (
    <div className="flex h-full min-h-[10rem] flex-col items-center justify-center px-2 text-center">
      <ShoppingCart
        className="size-10 text-border"
        strokeWidth={1.25}
        aria-hidden
      />
      <p className="mt-3 max-w-[18rem] text-sm text-muted">
        {t("pos.cartEmptyHint")}
      </p>
    </div>
  );
}
