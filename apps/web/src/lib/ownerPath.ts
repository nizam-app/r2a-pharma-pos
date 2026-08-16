/**
 * Owner web path helpers (Batch B). Chrome routes: /, /sales, /inventory.
 * Later nav (Purchasing, …) must not appear here.
 * Batch G: `/sales/:id` is a live URL (detail page filled in Batch I).
 * Batch J: `/inventory` is the live list.
 * Batch K: `/inventory/:id` is live Product Details; `/inventory/new`,
 * `/inventory/expiry`, `/inventory/:id/receive` stay shells until L–N.
 */

export const OWNER_PATHS = ["/", "/sales", "/inventory"] as const;

export type OwnerPath = (typeof OWNER_PATHS)[number];

export function isOwnerPath(value: string): value is OwnerPath {
  return (OWNER_PATHS as readonly string[]).includes(value);
}

/** True for chrome routes and known Slice 1 subpaths. Unknown → rewrite to /. */
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
  return false;
}

/** Map the URL onto a live chrome route. Unknown paths → Dashboard. */
export function matchOwnerPath(pathname: string): OwnerPath {
  if (pathname === "/sales" || pathname.startsWith("/sales/")) return "/sales";
  if (pathname === "/inventory" || pathname.startsWith("/inventory/")) {
    return "/inventory";
  }
  return "/";
}

export function ownerPathTitleKey(
  path: OwnerPath,
): "nav.dashboard" | "nav.sales" | "nav.inventory" {
  if (path === "/sales") return "nav.sales";
  if (path === "/inventory") return "nav.inventory";
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
  | { kind: "receive"; productId: string };

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
  if (parts.length === 2 && parts[1] === "receive" && parts[0]) {
    return { kind: "receive", productId: decodeSegment(parts[0]) };
  }
  if (parts.length === 1 && parts[0]) {
    return { kind: "detail", productId: decodeSegment(parts[0]) };
  }
  return { kind: "list" };
}
