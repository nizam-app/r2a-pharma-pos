import { DashboardPage } from "@/features/dashboard";
import {
  AddProductPage,
  InventoryLaterPage,
  InventoryPage,
  ProductDetailPage,
} from "@/features/inventory";
import { SaleDetailPage, SalesPage } from "@/features/sales";
import { inventorySubpath, salesDetailIdFromPath } from "@/lib/ownerPath";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
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
    if (sub.kind === "detail") {
      return <ProductDetailPage productId={sub.productId} />;
    }
    if (sub.kind === "new") {
      return <AddProductPage />;
    }
    return <InventoryLaterPage kind={sub.kind} />;
  }
  return <DashboardPage />;
}

/**
 * Locked Admin Portal chrome. Dashboard KPIs are Batch G; Sales list is Batch H;
 * Transaction Details is Batch I; Inventory list is Batch J; Product Details is Batch K.
 */
export function AppShell() {
  return (
    <div className="flex h-full min-h-0 bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-canvas-pattern">
        <Header />
        <main className="min-h-0 flex-1 overflow-auto bg-transparent">
          <ShellMain />
        </main>
      </div>
    </div>
  );
}
