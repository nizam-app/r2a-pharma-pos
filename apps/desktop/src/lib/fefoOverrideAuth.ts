/**
 * Manager Authorization (FEFO override) — Batch O stub helpers.
 *
 * TODO(real integration): verify MANAGER/OWNER credentials server-side,
 * role-check, rate-limit, and write an audit log entry on the sale line /
 * ingest payload (FEFO override flag). Do not ship this permissive stub to pilot.
 */

import type { PosBatchRow } from "@/lib/batchSelect";

/** Mock shows 4 PIN boxes; stub accepts any complete 4-digit PIN (same spirit as loyalty OTP). */
export const STUB_MANAGER_PIN_LENGTH = 4;

export type FefoOverrideAuthorizerOption = {
  id: string;
  name: string;
  roleLabel: string;
};

/**
 * Local stub list for Authorized By — not loaded from API yet.
 * TODO: replace with MANAGER/OWNER staff roster from cloud/local directory.
 */
export const STUB_AUTHORIZER_OPTIONS: FefoOverrideAuthorizerOption[] = [
  { id: "stub-owner", name: "Demo Owner", roleLabel: "Owner" },
  { id: "stub-manager", name: "Demo Manager", roleLabel: "Manager" },
];

/** Staged after stub Authorize — Batch P consumes for Edit banner / cart badge / toast. */
export type StagedFefoOverride = {
  lineId: string;
  requestedBatch: PosBatchRow;
  fefoBatch: PosBatchRow | null;
  authorizedById: string;
  authorizedByName: string;
  authorizedAt: string;
};

/**
 * Build cart-line FEFO override metadata from a staged authorization (Batch P).
 * TODO(real integration): persist on sale line / ingest FEFO override flag + audit API.
 */
export function toCartLineFefoOverride(staged: StagedFefoOverride) {
  return {
    authorizedById: staged.authorizedById,
    authorizedByName: staged.authorizedByName,
    authorizedAt: staged.authorizedAt,
    fefoBatchId: staged.fefoBatch?.batchId ?? null,
    fefoBatchNumber: staged.fefoBatch?.batchNumber ?? null,
    fefoExpiryDate: staged.fefoBatch?.expiryDate ?? null,
  };
}

export function isStubManagerPinComplete(digits: string): boolean {
  return new RegExp(`^\\d{${STUB_MANAGER_PIN_LENGTH}}$`).test(digits);
}

/**
 * Stub rule (Batch O): any complete 4-digit PIN is accepted.
 * Real rule later: server-verified manager/owner PIN or password.
 */
export function acceptStubManagerPin(digits: string): boolean {
  return isStubManagerPinComplete(digits);
}

export function authorizerLabel(option: FefoOverrideAuthorizerOption): string {
  return `${option.name} (${option.roleLabel})`;
}
