import { useLocale, type MessageKey } from "@/i18n";

type LaterKind = "expiry" | "new" | "receive";

const HINT: Record<LaterKind, MessageKey> = {
  expiry: "inventory.later.expiry",
  new: "inventory.later.new",
  receive: "inventory.later.receive",
};

const TITLE: Record<LaterKind, MessageKey> = {
  expiry: "inventory.later.expiryTitle",
  new: "inventory.later.newTitle",
  receive: "inventory.later.receiveTitle",
};

/**
 * Slice 1 route shells for screens that land in later batches (L–N).
 * Product Details is Batch K (`ProductDetailPage`). Do not invent Add / Receive / Expiry here.
 */
export function InventoryLaterPage({ kind }: { kind: LaterKind }) {
  const { t } = useLocale();
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {t(TITLE[kind])}
      </h1>
      <p className="mt-2 text-sm text-muted">{t(HINT[kind])}</p>
    </div>
  );
}
