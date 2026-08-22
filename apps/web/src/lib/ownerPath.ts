/**
 * Owner web path helpers. Batch S adds Purchasing and Suppliers shells.
 * Batch G: `/sales/:id` is a live URL (detail page filled in Batch I).
 * Batch J: `/inventory` is the live list.
 * Batch K: `/inventory/:id` is live Product Details. Add Product is Batch L,
 * Receive Stock is Batch M. W2 adds Edit Product; Batch N adds `/inventory/expiry`.
 * Batch T: `/purchasing` is the live list; `/purchasing/new`, `/purchasing/:poId`,
 * `/purchasing/:poId/receive`, and `/purchasing/:poId/edit` are registered subpaths.
 * Batch X: `/suppliers` is the live directory; `/suppliers/new`,
 * `/suppliers/returns`, `/suppliers/returns/new`, `/suppliers/returns/:manifestId`,
 * and `/suppliers/:supplierId` are registered subpaths.
 * Batch AG: `/customers` becomes a live chrome route; `/customers/new`,
 * `/customers/:id`, and `/customers/:id/review` are registered subpaths.
 * Batch AZ: `/staff/shifts` list and `/staff/shifts/:id` placeholder before
 * staff user detail params. Batch BC enables `/reports`; Batch BF adds `/reports/sales`.
 */

export const OWNER_PATHS = [
  "/",
  "/sales",
  "/inventory",
  "/purchasing",
  "/suppliers",
  "/customers",
  "/staff",
  "/reports",
] as const;

export type OwnerPath = (typeof OWNER_PATHS)[number];

export function isOwnerPath(value: string): value is OwnerPath {
  return (OWNER_PATHS as readonly string[]).includes(value);
}

/** True for live chrome routes and known subpaths. Unknown → rewrite to /. */
export function isLiveOwnerUrl(pathname: string): boolean {
  if ((OWNER_PATHS as readonly string[]).includes(pathname)) return true;
  if (pathname.startsWith("/sales/") && pathname.length > "/sales/".length) {
    return true;
  }
  if (
    pathname.startsWith("/inventory/") &&
    pathname.length > "/inventory/".length
  ) {
    return true;
  }
if (
    pathname.startsWith("/purchasing/") &&
    pathname.length > "/purchasing/".length
  ) {
    return true;
  }
  if (
    pathname.startsWith("/suppliers/") &&
    pathname.length > "/suppliers/".length
  ) {
    return true;
  }
  if (
    pathname.startsWith("/customers/") &&
    pathname.length > "/customers/".length
  ) {
    return true;
  }
  if (
    pathname.startsWith("/staff/") &&
    pathname.length > "/staff/".length
  ) {
    return true;
  }
  if (
    pathname.startsWith("/reports/") &&
    pathname.length > "/reports/".length
  ) {
    return true;
  }
  return false;
}

/** Map the URL onto a live chrome route. Unknown paths → Dashboard. */
export function matchOwnerPath(pathname: string): OwnerPath {
  if (pathname === "/sales" || pathname.startsWith("/sales/")) return "/sales";
if (pathname === "/inventory" || pathname.startsWith("/inventory/")) {
    return "/inventory";
  }
  if (pathname === "/purchasing" || pathname.startsWith("/purchasing/")) {
    return "/purchasing";
  }
  if (pathname === "/suppliers" || pathname.startsWith("/suppliers/")) {
    return "/suppliers";
  }
  if (pathname === "/customers" || pathname.startsWith("/customers/")) {
    return "/customers";
  }
  if (pathname === "/staff" || pathname.startsWith("/staff/")) {
    return "/staff";
  }
  if (pathname === "/reports" || pathname.startsWith("/reports/")) return "/reports";
  return "/";
}

export type ReportsSubpath = { kind: "dashboard" } | { kind: "sales" };

export function reportsSubpath(pathname: string): ReportsSubpath {
  if (pathname === "/reports/sales") return { kind: "sales" };
  return { kind: "dashboard" };
}

export function ownerPathTitleKey(
  path: OwnerPath,
):
  | "nav.dashboard"
  | "nav.sales"
  | "nav.inventory"
  | "nav.purchasing"
  | "nav.suppliers"
  | "nav.customers"
  | "nav.staff"
  | "nav.reports" {
  if (path === "/sales") return "nav.sales";
  if (path === "/inventory") return "nav.inventory";
  if (path === "/purchasing") return "nav.purchasing";
  if (path === "/suppliers") return "nav.suppliers";
  if (path === "/customers") return "nav.customers";
  if (path === "/staff") return "nav.staff";
  if (path === "/reports") return "nav.reports";
  return "nav.dashboard";
}

/** Sale.id from `/sales/:id`. Null on the list route. */
export function salesDetailIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/sales/")) return null;
  const id = pathname.slice("/sales/".length).split("/").filter(Boolean)[0];
  if (!id) return null;
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export type InventorySubpath =
  | { kind: "list" }
  | { kind: "expiry" }
  | { kind: "new" }
  | { kind: "detail"; productId: string }
  | { kind: "edit"; productId: string }
  | { kind: "receive"; productId: string }
  | { kind: "batch"; productId: string; batchId: string };

function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Slice 1 inventory routes. `/inventory/expiry` and `/inventory/new` before `/:id`. */
export function inventorySubpath(pathname: string): InventorySubpath {
  if (pathname === "/inventory") return { kind: "list" };
  if (!pathname.startsWith("/inventory/")) return { kind: "list" };
  const parts = pathname.slice("/inventory/".length).split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "expiry") return { kind: "expiry" };
  if (parts.length === 1 && parts[0] === "new") return { kind: "new" };
  if (parts.length === 2 && parts[1] === "edit" && parts[0]) {
    return { kind: "edit", productId: decodeSegment(parts[0]) };
  }
  if (parts.length === 2 && parts[1] === "receive" && parts[0]) {
    return { kind: "receive", productId: decodeSegment(parts[0]) };
  }
  if (
    parts.length === 3 &&
    parts[1] === "batches" &&
    parts[0] &&
    parts[2]
  ) {
    return {
      kind: "batch",
      productId: decodeSegment(parts[0]),
      batchId: decodeSegment(parts[2]),
    };
  }
  if (parts.length === 1 && parts[0]) {
    return { kind: "detail", productId: decodeSegment(parts[0]) };
  }
  return { kind: "list" };
}

export type PurchasingSubpath =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "detail"; poId: string }
  | { kind: "receive"; poId: string }
  | { kind: "edit"; poId: string };

/** Batch T purchasing routes. `/purchasing/new` before `/:id` params. */
export function purchasingSubpath(pathname: string): PurchasingSubpath {
  if (pathname === "/purchasing") return { kind: "list" };
  if (!pathname.startsWith("/purchasing/")) return { kind: "list" };
  const parts = pathname.slice("/purchasing/".length).split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "new") return { kind: "new" };
  if (parts.length === 2 && parts[1] === "edit" && parts[0]) {
    return { kind: "edit", poId: decodeSegment(parts[0]) };
  }
  if (parts.length === 2 && parts[1] === "receive" && parts[0]) {
    return { kind: "receive", poId: decodeSegment(parts[0]) };
  }
  if (parts.length === 1 && parts[0]) {
    return { kind: "detail", poId: decodeSegment(parts[0]) };
  }
  return { kind: "list" };
}

export type SuppliersSubpath =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "detail"; supplierId: string }
  | { kind: "returns" }
  | { kind: "returnsNew" }
  | { kind: "returnsManifest"; manifestId: string };

/**
 * Batch X suppliers routes. `/suppliers/returns` and `/suppliers/new` before
 * `/:id` params; `/suppliers/returns/:manifestId` after `/suppliers/returns`.
 */
export function suppliersSubpath(pathname: string): SuppliersSubpath {
  if (pathname === "/suppliers") return { kind: "list" };
  if (!pathname.startsWith("/suppliers/")) return { kind: "list" };
  const parts = pathname.slice("/suppliers/".length).split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "returns") return { kind: "returns" };
  if (parts.length === 1 && parts[0] === "new") return { kind: "new" };
  if (parts.length === 2 && parts[0] === "returns" && parts[1] === "new") {
    return { kind: "returnsNew" };
  }
  if (parts.length === 2 && parts[0] === "returns" && parts[1]) {
    return { kind: "returnsManifest", manifestId: decodeSegment(parts[1]) };
  }
  if (parts.length === 1 && parts[0]) {
    return { kind: "detail", supplierId: decodeSegment(parts[0]) };
  }
  return { kind: "list" };
}

export type CustomersSubpath =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "detail"; customerId: string }
  | { kind: "review"; customerId: string };

/**
 * Batch AG customers routes. `/customers/new` before `/:id` params;
 * `/customers/:id/review` after detail. Batch AG renders placeholder shells only.
 */
export function customersSubpath(pathname: string): CustomersSubpath {
  if (pathname === "/customers") return { kind: "list" };
  if (!pathname.startsWith("/customers/")) return { kind: "list" };
  const parts = pathname.slice("/customers/".length).split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "new") return { kind: "new" };
  if (parts.length === 2 && parts[1] === "review" && parts[0]) {
    return { kind: "review", customerId: decodeSegment(parts[0]) };
  }
  if (parts.length === 1 && parts[0]) {
    return { kind: "detail", customerId: decodeSegment(parts[0]) };
  }
  return { kind: "list" };
}

export type StaffSubpath =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "shifts" }
  | { kind: "shiftDetail"; shiftId: string }
  | { kind: "detail"; userId: string }
  | { kind: "edit"; userId: string };

/**
 * Batch AP staff routes. `/staff/new` and Batch AZ `/staff/shifts` before
 * `/:id` params; `/staff/:id/edit` after detail.
 */
export function staffSubpath(pathname: string): StaffSubpath {
  if (pathname === "/staff") return { kind: "list" };
  if (!pathname.startsWith("/staff/")) return { kind: "list" };
  const parts = pathname.slice("/staff/".length).split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "new") return { kind: "new" };
  if (parts.length === 1 && parts[0] === "shifts") return { kind: "shifts" };
  if (parts.length === 2 && parts[0] === "shifts" && parts[1]) {
    return { kind: "shiftDetail", shiftId: decodeSegment(parts[1]) };
  }
  if (parts.length === 2 && parts[1] === "edit" && parts[0]) {
    return { kind: "edit", userId: decodeSegment(parts[0]) };
  }
  if (parts.length === 1 && parts[0]) {
    return { kind: "detail", userId: decodeSegment(parts[0]) };
  }
  return { kind: "list" };
}
