import { apiRequest, apiRequestEnvelope } from "./api";

/** Mirrors Prisma CustomerStatus (REJECTED hidden from the owner directory). */
export type CustomerStatus = "ACTIVE" | "PENDING_APPROVAL" | "INACTIVE";

/** Mirrors Prisma CustomerSource. */
export type CustomerSource = "OWNER_CREATED" | "POS_REGISTRATION";

export type CustomerListRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: CustomerStatus;
  source: CustomerSource;
  storeId: string | null;
  loyaltyPoints: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
};

export type CustomerKpis = {
  registered: number;
  pending: number;
  active90d: number;
  loyaltyPointsIssued: number;
};

export type CustomersResult = {
  items: CustomerListRow[];
  total: number;
  limit: number;
  offset: number;
  kpis: CustomerKpis;
};

export type CustomerListQuery = {
  q?: string;
  status?: CustomerStatus;
  source?: CustomerSource;
  sort?: "name" | "createdAt" | "loyaltyPoints";
  limit?: number;
  offset?: number;
};

/** Mirrors customerGenderSchema (enum is not exported from shared-types). */
export type CustomerGender = "MALE" | "FEMALE" | "OTHER";

export type CustomerCreatePayload = {
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: Date;
  gender?: CustomerGender;
  address?: string;
};

export type CreatedCustomer = {
  id: string;
  name: string;
  phone: string;
  status: CustomerStatus;
  source: CustomerSource;
};

/** phone-check may surface any status, including REJECTED. */
export type PhoneCheckCustomer = {
  id: string;
  name: string;
  phone: string;
  status: CustomerStatus | "REJECTED";
  source: CustomerSource;
};

export type PhoneCheckResult = {
  exists: boolean;
  customer: PhoneCheckCustomer | null;
};

const EMPTY_KPIS: CustomerKpis = {
  registered: 0,
  pending: 0,
  active90d: 0,
  loyaltyPointsIssued: 0,
};

/** Live OWNER customer directory — Batch AH. KPIs come from meta, not mocked. */
export async function fetchCustomers(
  query: CustomerListQuery = {},
): Promise<CustomersResult> {
  const q = new URLSearchParams();
  q.set("limit", String(query.limit ?? 25));
  q.set("offset", String(query.offset ?? 0));
  const search = query.q?.trim();
  if (search) q.set("q", search);
  if (query.status) q.set("status", query.status);
  if (query.source) q.set("source", query.source);
  if (query.sort) q.set("sort", query.sort);

  const { data, meta } = await apiRequestEnvelope<CustomerListRow[]>(
    `/api/v1/owner/customers?${q.toString()}`,
  );

  const m =
    meta && typeof meta === "object"
      ? (meta as {
          total?: number;
          limit?: number;
          offset?: number;
          kpis?: CustomerKpis;
        })
      : {};

  return {
    items: Array.isArray(data) ? data : [],
    total: typeof m.total === "number" ? m.total : 0,
    limit: typeof m.limit === "number" ? m.limit : (query.limit ?? 25),
    offset: typeof m.offset === "number" ? m.offset : (query.offset ?? 0),
    kpis: m.kpis ?? EMPTY_KPIS,
  };
}

/** Live duplicate check — Batch AI. Owner-created customers become ACTIVE. */
export async function createCustomer(
  input: CustomerCreatePayload,
): Promise<CreatedCustomer> {
  return apiRequest<CreatedCustomer>("/api/v1/customers", {
    method: "POST",
    body: input,
  });
}

/** Live phone duplicate check (Batch AI Add Customer). */
export async function checkCustomerPhone(
  phone: string,
): Promise<PhoneCheckResult> {
  const q = new URLSearchParams({ phone });
  return apiRequest<PhoneCheckResult>(`/api/v1/customers/phone-check?${q}`);
}

export type CustomerActor = {
  id: string;
  name: string;
  role: string;
};

export type CustomerPurchaseRow = {
  id: string;
  receiptNo: string | null;
  soldAt: string;
  total: number;
  storeName: string | null;
};

export type CustomerLoyaltyRow = {
  id: string;
  soldAt: string;
  loyaltyPrevious: number;
  loyaltyUsed: number;
  loyaltyEarned: number;
};

/** GET /api/v1/owner/customers/:id — profile + audit + live purchase/loyalty rows. */
export type CustomerDetail = {
  profile: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    dateOfBirth: string | null;
    gender: CustomerGender | null;
    address: string | null;
    status: CustomerStatus;
    source: CustomerSource;
    storeId: string | null;
    storeName: string | null;
    loyaltyPoints: number;
    createdAt: string;
    updatedAt: string;
  };
  audit: {
    createdByUserId: string | null;
    createdBy: CustomerActor | null;
    approvedAt: string | null;
    approvedByUserId: string | null;
    approvedBy: CustomerActor | null;
    rejectedAt: string | null;
    rejectedByUserId: string | null;
    rejectedBy: CustomerActor | null;
    rejectionNote: string | null;
  };
  purchaseHistory: {
    saleCount: number;
    totalSpent: number;
    lastPurchaseAt: string | null;
    rows: CustomerPurchaseRow[];
  };
  loyaltyActivity: {
    pointsUsed: number;
    pointsEarned: number;
    rows: CustomerLoyaltyRow[];
  };
};

/** Live OWNER customer detail — Batch AJ. KPIs and rows come from live data. */
export async function fetchCustomerDetail(
  customerId: string,
): Promise<CustomerDetail> {
  return apiRequest<CustomerDetail>(
    `/api/v1/owner/customers/${encodeURIComponent(customerId)}`,
  );
}
