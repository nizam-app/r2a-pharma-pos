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
import {
  CreatePurchaseOrderPage,
  PurchaseOrderDetailPage,
  PurchasingPage,
  ReceiveAgainstPurchaseOrderPage,
} from "@/features/purchasing";
import {
  AddSupplierPage,
  CreateReturnManifestPage,
  ExpiryReturnsPage,
  SupplierDetailsPage,
  SuppliersPage,
} from "@/features/suppliers";
import {
  AddCustomerPage,
  CustomerDetailsPage,
  CustomersPage,
  RegistrationReviewPage,
} from "@/features/customers";
import { useLocale } from "@/i18n";
import {
  customersSubpath,
  inventorySubpath,
  purchasingSubpath,
  salesDetailIdFromPath,
  suppliersSubpath,
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
    if (sub.kind === "detail") {
      return <PurchaseOrderDetailPage poId={sub.poId} />;
    }
    if (sub.kind === "receive") {
      return (
        <ReceiveAgainstPurchaseOrderPage
          key={sub.poId}
          poId={sub.poId}
        />
      );
    }
    return <PurchasingPlaceholder />;
  }
  if (path === "/suppliers") {
    const sub = suppliersSubpath(pathname);
    if (sub.kind === "list") return <SuppliersPage />;
    if (sub.kind === "new") return <AddSupplierPage />;
    if (sub.kind === "detail") {
      return <SupplierDetailsPage supplierId={sub.supplierId} />;
    }
    if (sub.kind === "returns") return <ExpiryReturnsPage />;
    if (sub.kind === "returnsNew") return <CreateReturnManifestPage />;
    if (sub.kind === "returnsManifest") {
      return (
        <SupplierPlaceholder
          titleKey="suppliers.placeholder.manifestTitle"
          hintKey="suppliers.placeholder.manifest"
        />
      );
    }
    return <SuppliersPage />;
  }
  if (path === "/customers") {
    const sub = customersSubpath(pathname);
    if (sub.kind === "list") return <CustomersPage />;
    if (sub.kind === "new") return <AddCustomerPage />;
    if (sub.kind === "review") {
      return (
        <RegistrationReviewPage
          key={sub.customerId}
          customerId={sub.customerId}
        />
      );
    }
    if (sub.kind === "detail") {
      return <CustomerDetailsPage key={sub.customerId} customerId={sub.customerId} />;
    }
  }
  return <DashboardPage />;
}

function SupplierPlaceholder({
  titleKey,
  hintKey,
}: {
  titleKey: "suppliers.placeholder.manifestTitle";
  hintKey: "suppliers.placeholder.manifest";
}) {
  const { t } = useLocale();
  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">{t(titleKey)}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t(hintKey)}</p>
      </div>
    </section>
  );
}

function PurchasingPlaceholder() {
  const { t } = useLocale();
  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">
          {t("purchasing.placeholder.editTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {t("purchasing.placeholder.edit")}
        </p>
      </div>
    </section>
  );
}

/**
 * Locked Admin Portal chrome. Dashboard KPIs are Batch G; Sales list is Batch H;
 * Transaction Details is Batch I; Inventory list is Batch J; Product Details is Batch K;
 * Receive Stock is Batch M. Expiry Management is Batch N. Batch S enables
 * Purchasing and Suppliers as localized placeholder shells. Batch T fills the
 * Purchasing list; Batch U fills Create Purchase Order; Batch V fills the
 * Purchase Order Details page; Batch W fills Receive Stock against a PO
 * (/purchasing/:poId/receive). edit still renders a localized placeholder.
 * Batch X fills the Suppliers directory. Batch Y fills the Add Supplier form
 * (/suppliers/new). Batch Z fills the live Supplier Details page
 * (/suppliers/:supplierId). Batch AA fills the Expiry Returns queue at
 * /suppliers/returns. Batch AB fills Create Return Manifest at
 * /suppliers/returns/new. /suppliers/returns/:manifestId stays a placeholder.
 * Batch AG enables Customers as a live chrome route (/customers,
 * /customers/new, /customers/:id, /customers/:id/review) with placeholder
 * shells; Batch AH fills the directory, Batch AI fills /customers/new
 * (Add Customer + create confirm), Batch AJ fills /customers/:id
 * (Customer Details; pending redirects to Review), Batch AK fills
 * /customers/:id/review (Registration Review + Approve/Reject).
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
