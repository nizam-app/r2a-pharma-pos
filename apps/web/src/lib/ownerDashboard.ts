import { apiRequest } from "./api";
import { utcTodayStart, utcYmd } from "./format";

export type DashboardRangePreset = "today" | "last7" | "last30";

export type KpiTrend = "up" | "down" | "steady";

export type DashboardKpiBlock = {
  sales: number;
  netProfit: number;
  txnCount: number;
  avgSale: number;
};

export type DashboardKpiDelta = {
  delta: number;
  deltaPct: number | null;
  trend: KpiTrend;
};

export type OwnerDashboardPayload = {
  range: { from: string; to: string };
  netProfitFormula?: string;
  kpis: {
    today: DashboardKpiBlock;
    yesterday: DashboardKpiBlock;
    vsYesterday: {
      sales: DashboardKpiDelta;
      netProfit: DashboardKpiDelta;
      txnCount: DashboardKpiDelta;
      avgSale: DashboardKpiDelta;
    };
    period: DashboardKpiBlock;
  };
  dailyBars: Array<{
    date: string;
    sales: number;
    netProfit: number;
    txnCount: number;
  }>;
  paymentMix?: { CASH: number; CARD: number; MFS: number };
  salesKpis?: {
    grossSales: number;
    netSales: number;
    discountTotal: number;
    txnCount: number;
    avgSale: number;
    vsPrev: DashboardKpiDelta;
  };
  topCashier?: {
    userId: string;
    name: string;
    sales: number;
    txnCount: number;
  } | null;
  cashiers?: Array<{ id: string; name: string }>;
  inventoryHealth: {
    lowStock: number;
    outOfStock: number;
    expiring30d: number;
    expiring90d?: number;
    expired?: number;
  };
  fefoOverrides: { today: number; week: number };
  expiringStockValue: number;
  staff?: {
    activeCashiers: number;
    openShifts: number | null;
    cashVarianceToday: number | null;
  };
  recentSales: Array<{
    id: string;
    receiptNo: string | null;
    soldAt: string;
    total: number;
    netProfit?: number;
    customerName: string | null;
    cashierName: string;
    paymentMethods: Array<"CASH" | "CARD" | "MFS" | string>;
    loyaltyUsed?: number;
    paymentAmounts?: Array<{ method: string; amount: number }>;
    /** From sale notes `mfs:provider=…`. Null when not MFS or unknown. */
    mfsProvider?: "BKASH" | "NAGAD" | "ROCKET" | null;
  }>;
};

export function rangeForPreset(preset: DashboardRangePreset): {
  from: string;
  to: string;
} {
  const to = utcTodayStart();
  const from = new Date(to);
  if (preset === "last7") {
    from.setUTCDate(from.getUTCDate() - 6);
  } else if (preset === "last30") {
    from.setUTCDate(from.getUTCDate() - 29);
  }
  return { from: utcYmd(from), to: utcYmd(to) };
}

export async function fetchOwnerDashboardRange(
  from: string,
  to: string,
): Promise<OwnerDashboardPayload> {
  const q = new URLSearchParams({ from, to });
  return apiRequest<OwnerDashboardPayload>(
    `/api/v1/owner/dashboard?${q.toString()}`,
  );
}

export async function fetchOwnerDashboard(
  preset: DashboardRangePreset,
): Promise<OwnerDashboardPayload> {
  const { from, to } = rangeForPreset(preset);
  return fetchOwnerDashboardRange(from, to);
}
