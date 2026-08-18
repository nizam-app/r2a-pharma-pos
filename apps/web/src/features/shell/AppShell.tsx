import { DashboardPage } from "@/features/dashboard";
import {
  AddProductPage,
  BatchManagementPage,
  EditProductPage,
  ExpiryManagementPage,
  InventoryPage,
  ProductDetailPage,
  ReceiveStockPage,
} from "@/features/inventory";
import { SaleDetailPage, SalesPage } from "@/features/sales";
import { CreatePurchaseOrderPage, PurchasingPage } from "@/features/purchasing";
import { useLocale } from "@/i18n";
import {
  inventorySubpath,
  purchasingSubpath,
  salesDetailIdFromPath,
} from "@/lib/ownerPath";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { useEffect, useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

function ShellMain() {
  const { path, pathname } = useOwnerPath();
  if (path === "/sales") {
    const saleId = salesDetailIdFromPath(pathname);
    if (saleId) return <SaleDetailPage saleId={saleId} />;
    return <SalesPage />;
  }
  if (path === "/inventory") {
    const sub = inventorySubpath(pathname);
    if (sub.kind === "list") return <InventoryPage />;
    if (sub.kind === "expiry") return <ExpiryManagementPage />;
    if (sub.kind === "detail") {
      return <ProductDetailPage productId={sub.productId} />;
    }
    if (sub.kind === "new") {
      return <AddProductPage />;
    }
    if (sub.kind === "edit") {
      return <EditProductPage productId={sub.productId} />;
    }
    if (sub.kind === "receive") {
      return <ReceiveStockPage productId={sub.productId} />;
    }
    if (sub.kind === "batch") {
      return (
        <BatchManagementPage
          key={`${sub.productId}:${sub.batchId}`}
          productId={sub.productId}
          batchId={sub.batchId}
        />
      );
    }
    return <InventoryPage />;
  }
  if (path === "/purchasing") {
    const sub = purchasingSubpath(pathname);
    if (sub.kind === "list") return <PurchasingPage />;
    if (sub.kind === "new") return <CreatePurchaseOrderPage />;
    return <PurchasingPlaceholder kind={sub.kind} />;
  }
  if (path === "/suppliers") {
    return <SectionPlaceholder section="suppliers" />;
  }
  return <DashboardPage />;
}

function PurchasingPlaceholder({
  kind,
}: {
  kind: "new" | "detail" | "receive" | "edit";
}) {
  const { t } = useLocale();
  const titleKey =
    kind === "new"
      ? "purchasing.placeholder.newTitle"
      : kind === "receive"
        ? "purchasing.placeholder.receiveTitle"
        : kind === "edit"
          ? "purchasing.placeholder.editTitle"
          : "purchasing.placeholder.detailTitle";
  const hintKey =
    kind === "new"
      ? "purchasing.placeholder.new"
      : kind === "receive"
        ? "purchasing.placeholder.receive"
        : kind === "edit"
          ? "purchasing.placeholder.edit"
          : "purchasing.placeholder.detail";

  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">{t(titleKey)}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t(hintKey)}</p>
      </div>
    </section>
  );
}

function SectionPlaceholder({
  section,
}: {
  section: "purchasing" | "suppliers";
}) {
  const { t } = useLocale();
  const titleKey =
    section === "purchasing"
      ? "page.purchasingTitle"
      : "page.suppliersTitle";
  const hintKey =
    section === "purchasing" ? "page.purchasingHint" : "page.suppliersHint";

  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">{t(titleKey)}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t(hintKey)}</p>
      </div>
    </section>
  );
}

/**
 * Locked Admin Portal chrome. Dashboard KPIs are Batch G; Sales list is Batch H;
 * Transaction Details is Batch I; Inventory list is Batch J; Product Details is Batch K;
 * Receive Stock is Batch M. Expiry Management is Batch N. Batch S enables
 * Purchasing and Suppliers as localized placeholder shells. Batch T fills the
 * Purchasing list; its create/detail/receive/edit routes render localized placeholders.
 */
export function AppShell() {
  const { t } = useLocale();
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    if (!navigationOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setNavigationOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [navigationOpen]);

  return (
    <div className="flex h-full min-h-0 bg-canvas">
      <Sidebar className="hidden md:flex" />
      {navigationOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label={t("nav.closeMenu")}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setNavigationOpen(false)}
          />
          <Sidebar className="relative h-full shadow-2xl" onClose={() => setNavigationOpen(false)} />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col bg-canvas-pattern">
        <Header onOpenNavigation={() => setNavigationOpen(true)} />
        <main className="min-h-0 flex-1 overflow-auto bg-transparent">
          <ShellMain />
        </main>
      </div>
    </div>
  );
}
