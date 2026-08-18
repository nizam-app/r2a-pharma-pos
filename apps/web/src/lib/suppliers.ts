import { apiRequest } from "./api";

export type SupplierStatus = "ACTIVE" | "HOLD" | "DRAFT";

export type SupplierOption = {
  id: string;
  name: string;
  status: SupplierStatus;
  isActive: boolean;
  phone: string | null;
  city: string | null;
};

/** Live OWNER active suppliers for the Create Purchase Order dropdown. */
export async function fetchActiveSuppliers(): Promise<SupplierOption[]> {
  return apiRequest<SupplierOption[]>(
    "/api/v1/owner/suppliers?isActive=true&limit=100",
  );
}