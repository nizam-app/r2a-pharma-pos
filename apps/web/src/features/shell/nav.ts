import {
  BarChart3,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "@/i18n";
import type { OwnerPath } from "@/lib/ownerPath";

export type NavId =
  | "dashboard"
  | "sales"
  | "inventory"
  | "purchasing"
  | "suppliers"
  | "customers"
  | "staff"
  | "reports"
  | "auditFefo"
  | "settings"
  | "help"
  | "ownerProfile";

export type NavItem = {
  id: NavId;
  labelKey: MessageKey;
  icon: LucideIcon;
  live: boolean;
  path?: OwnerPath;
};

/** Live Owner routes. Unauthorized later items stay visible and disabled. */
export const PRIMARY_NAV: readonly NavItem[] = [
  {
    id: "dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    live: true,
    path: "/",
  },
  {
    id: "sales",
    labelKey: "nav.sales",
    icon: ShoppingCart,
    live: true,
    path: "/sales",
  },
  {
    id: "inventory",
    labelKey: "nav.inventory",
    icon: Package,
    live: true,
    path: "/inventory",
  },
  {
    id: "purchasing",
    labelKey: "nav.purchasing",
    icon: ShoppingBag,
    live: true,
    path: "/purchasing",
  },
  {
    id: "suppliers",
    labelKey: "nav.suppliers",
    icon: Truck,
    live: true,
    path: "/suppliers",
  },
  {
    id: "customers",
    labelKey: "nav.customers",
    icon: Users,
    live: true,
    path: "/customers",
  },
  {
    id: "staff",
    labelKey: "nav.staff",
    icon: ClipboardList,
    live: true,
    path: "/staff",
  },
  {
    id: "reports",
    labelKey: "nav.reports",
    icon: BarChart3,
    live: true,
    path: "/reports",
  },
  {
    id: "auditFefo",
    labelKey: "nav.auditFefo",
    icon: ShieldCheck,
    live: false,
  },
  {
    id: "settings",
    labelKey: "nav.settings",
    icon: Settings,
    live: false,
  },
] as const;

export const FOOTER_NAV: readonly NavItem[] = [
  {
    id: "help",
    labelKey: "nav.help",
    icon: CircleHelp,
    live: false,
  },
  {
    id: "ownerProfile",
    labelKey: "nav.ownerProfile",
    icon: UserCircle,
    live: false,
  },
] as const;
