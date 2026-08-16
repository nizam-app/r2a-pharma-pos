import type { SaleDetail, SaleDetailItem, SaleDetailPayment } from "./saleDetail";
import { isLoyaltyOnlyTender } from "./loyaltyTender";

/**
 * Activity facts only: soldAt, payments, FEFO flags.
 * Do not invent receipt-print or sale-started times, or card last-4.
 */
export type SaleActivityKind = "completed" | "payment" | "fefo" | "loyalty";

export type SaleActivityEvent = {
  id: string;
  kind: SaleActivityKind;
  at: string;
  payment?: SaleDetailPayment;
  item?: SaleDetailItem;
};

const KIND_RANK: Record<SaleActivityKind, number> = {
  completed: 0,
  payment: 1,
  loyalty: 1,
  fefo: 2,
};

export function buildSaleActivity(sale: SaleDetail): SaleActivityEvent[] {
  const events: SaleActivityEvent[] = [
    { id: `${sale.id}-completed`, kind: "completed", at: sale.soldAt },
  ];

  if (isLoyaltyOnlyTender(sale)) {
    events.push({
      id: `${sale.id}-loyalty`,
      kind: "loyalty",
      at: sale.soldAt,
    });
  } else {
    for (const payment of sale.payments) {
      events.push({
        id: payment.id || `${sale.id}-pay-${payment.method}`,
        kind: "payment",
        at: payment.createdAt || sale.soldAt,
        payment,
      });
    }
  }

  for (const item of sale.items) {
    if (!item.fefoOverride) continue;
    events.push({
      id: `${item.id}-fefo`,
      kind: "fefo",
      at: sale.soldAt,
      item,
    });
  }

  return events.sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    if (tb !== ta) return tb - ta;
    return KIND_RANK[a.kind] - KIND_RANK[b.kind];
  });
}
