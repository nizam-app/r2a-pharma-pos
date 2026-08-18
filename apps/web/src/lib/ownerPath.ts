/**
 * Owner web path helpers. Batch S adds Purchasing and Suppliers shells.
 * Batch G: `/sales/:id` is a live URL (detail page filled in Batch I).
 * Batch J: `/inventory` is the live list.
 * Batch K: `/inventory/:id` is live Product Details. Add Product is Batch L,
 * Receive Stock is Batch M. W2 adds Edit Product; Batch N adds `/inventory/expiry`.
 * Batch T: `/purchasing` is the live list; `/purchasing/new`, `/purchasing/:poId`,
 * `/purchasing/:poId/receive`, and `/purchasing/:poId/edit` are registered subpaths.
 */

export const OWNER_PATHS = [
  "/",
  "/sales",
  "/inventory",
  "/purchasing",
  "/suppliers",
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
  if (pathname === "/suppliers") return "/suppliers";
  return "/";
}

export function ownerPathTitleKey(
  path: OwnerPath,
):
  | "nav.dashboard"
  | "nav.sales"
  | "nav.inventory"
  | "nav.purchasing"
  | "nav.suppliers" {
  if (path === "/sales") return "nav.sales";
  if (path === "/inventory") return "nav.inventory";
  if (path === "/purchasing") return "nav.purchasing";
  if (path === "/suppliers") return "nav.suppliers";
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
