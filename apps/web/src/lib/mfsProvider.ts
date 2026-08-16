const MFS_PROVIDERS = ["BKASH", "NAGAD", "ROCKET"] as const;
export type MfsProviderId = (typeof MFS_PROVIDERS)[number];

/** POS ingest stores `mfs:provider=BKASH` (etc.) in sale.notes. */
export function parseMfsProvider(
  notes: string | null | undefined,
): MfsProviderId | null {
  if (!notes) return null;
  const match = /mfs:provider=(BKASH|NAGAD|ROCKET)\b/i.exec(notes);
  const id = match?.[1]?.toUpperCase();
  return MFS_PROVIDERS.find((p) => p === id) ?? null;
}

export function mfsProviderLabel(
  provider: string | null | undefined,
): string | null {
  if (provider === "BKASH") return "bKash";
  if (provider === "NAGAD") return "Nagad";
  if (provider === "ROCKET") return "Rocket";
  return null;
}
