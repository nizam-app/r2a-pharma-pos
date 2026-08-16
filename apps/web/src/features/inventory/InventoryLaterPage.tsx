import { useLocale, type MessageKey } from "@/i18n";

type LaterKind = "expiry";

const HINT: Record<LaterKind, MessageKey> = {
  expiry: "inventory.later.expiry",
};

const TITLE: Record<LaterKind, MessageKey> = {
  expiry: "inventory.later.expiryTitle",
};

/**
 * Slice 1 route shell for Expiry Management (Batch N).
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
