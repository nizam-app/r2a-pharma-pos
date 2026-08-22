import { apiRequest, apiRequestEnvelope } from "./api";


export type UserRole = "OWNER" | "MANAGER" | "CASHIER";

export type StaffListRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  storeId: string | null;
  isActive: boolean;
  phone: string | null;
  internalNote: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  username: string;
  storeName: string | null;
};

export type StaffKpis = {
  total: number;
  active: number;
  inactive: number;
  cashiers: number;
};

export type StaffListQuery = {
  q?: string;
  role?: UserRole;
  isActive?: "true" | "false" | "all";
  limit?: number;
  offset?: number;
};

export type StaffResult = {
  items: StaffListRow[];
  total: number;
  limit: number;
  offset: number;
  kpis: StaffKpis;
};

const EMPTY_KPIS: StaffKpis = {
  total: 0,
  active: 0,
  inactive: 0,
  cashiers: 0,
};

/** Live GET /api/v1/owner/users. Envelopes wrap items and KPIs. */
export async function fetchStaff(
  query: StaffListQuery = {},
): Promise<StaffResult> {
  const q = new URLSearchParams();
  q.set("limit", String(query.limit ?? 25));
  q.set("offset", String(query.offset ?? 0));
  const search = query.q?.trim();
  if (search) q.set("q", search);
  if (query.role) q.set("role", query.role);
  if (query.isActive) q.set("isActive", query.isActive);

  const { data, meta } = await apiRequestEnvelope<any>(
    `/api/v1/owner/users?${q.toString()}`,
  );

  const items =
    data && typeof data === "object" && "items" in data && Array.isArray((data as any).items)
      ? (data as any).items
      : Array.isArray(data)
      ? data
      : [];

  const kpis =
    data && typeof data === "object" && "kpis" in data
      ? (data as any).kpis
      : EMPTY_KPIS;

  const m =
    meta && typeof meta === "object"
      ? (meta as {
          total?: number;
          limit?: number;
          offset?: number;
        })
      : {};

  return {
    items,
    total: typeof m.total === "number" ? m.total : items.length,
    limit: typeof m.limit === "number" ? m.limit : (query.limit ?? 25),
    offset: typeof m.offset === "number" ? m.offset : (query.offset ?? 0),
    kpis,
  };
}

export type CreateStaffResult = {
  user: StaffListRow;
  temporaryPassword: string;
};

export type StaffCreatePayload = {
  name: string;
  phone: string;
  email: string;
  role: "MANAGER" | "CASHIER";
  internalNote?: string;
  storeId?: string;
};

export type StaffPatchPayload = Partial<{
  name: string;
  phone: string;
  email: string;
  role: "MANAGER" | "CASHIER";
  internalNote: string;
  storeId: string;
}>;

/** Live POST /api/v1/owner/users - OWNER only. Returns generated temp password. */
export async function createStaff(
  input: StaffCreatePayload,
): Promise<CreateStaffResult> {
  return apiRequest<CreateStaffResult>("/api/v1/owner/users", {
    method: "POST",
    body: input,
  });
}

export type StaffActivityRow = {
  id: string;
  type:
    | "CREATED"
    | "ROLE_CHANGED"
    | "BRANCH_CHANGED"
    | "DEACTIVATED"
    | "REACTIVATED"
    | "PROFILE_UPDATED";
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  createdAt: string;
  actorName: string;
  actorRole: UserRole;
};

export type StaffDetailResult = {
  user: StaffListRow;
  activities: StaffActivityRow[];
};

/** Live GET /api/v1/owner/users/:id - OWNER only. */
export async function fetchStaffDetail(id: string): Promise<StaffDetailResult> {
  return apiRequest<StaffDetailResult>(`/api/v1/owner/users/${encodeURIComponent(id)}`);
}

/** Live PATCH /api/v1/owner/users/:id - OWNER only; server blocks self edit. */
export async function patchStaff(
  id: string,
  input: StaffPatchPayload,
): Promise<StaffListRow> {
  return apiRequest<StaffListRow>(`/api/v1/owner/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

/** Live POST /api/v1/owner/users/:id/deactivate - OWNER only. */
export async function deactivateStaff(id: string, reason: string): Promise<void> {
  await apiRequest<void>(`/api/v1/owner/users/${encodeURIComponent(id)}/deactivate`, {
    method: "POST",
    body: { reason },
  });
}

/** Live POST /api/v1/owner/users/:id/reactivate - OWNER only. */
export async function reactivateStaff(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/owner/users/${encodeURIComponent(id)}/reactivate`, {
    method: "POST",
  });
}

