import type { OwnerSalesReportResponse } from "@r2a/shared-types";
import { apiRequest } from "./api";
import { rangeForPreset, type DashboardRangePreset } from "./ownerDashboard";

export type SalesReportRangePreset = Extract<
  DashboardRangePreset,
  "last7" | "last30"
>;

export type SalesReportQuery = {
  from?: string;
  to?: string;
  storeId?: string;
};

export type SalesReportPayload = OwnerSalesReportResponse;

export function rangeForSalesReportPreset(preset: SalesReportRangePreset): {
  from: string;
  to: string;
} {
  return rangeForPreset(preset);
}

export async function fetchSalesReport(
  query: SalesReportQuery = {},
): Promise<SalesReportPayload> {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.storeId) params.set("storeId", query.storeId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<SalesReportPayload>(`/api/v1/owner/reports/sales${suffix}`);
}
