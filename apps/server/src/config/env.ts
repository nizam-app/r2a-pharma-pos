import path from "node:path";
import dotenv from "dotenv";

/**
 * Env strategy (Batch A): load **repo root** `.env` only.
 * Do not use `apps/server/.env`. Never commit secrets — see root `.env.example`.
 */
const serverPackageRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(serverPackageRoot, "../..");
const rootEnvPath = path.join(repoRoot, ".env");

dotenv.config({ path: rootEnvPath });

function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw || raw.trim() === "") {
    return [];
  }
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Parse durations like `15m`, `7d`, `3600` (seconds) into milliseconds. */
export function parseDurationToMs(raw: string, fallbackMs: number): number {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const match = /^(\d+)(ms|s|m|h|d)$/i.exec(trimmed);
  if (!match) {
    return fallbackMs;
  }
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (multipliers[unit] ?? 1);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT) || 8787,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  /** Short-lived access JWT (default 15m for SaaS-style auth). */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  /** Opaque refresh token lifetime (default 7d). */
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? "7d",
  refreshTokenExpiresMs: parseDurationToMs(
    process.env.REFRESH_TOKEN_EXPIRES_IN ?? "7d",
    7 * 86_400_000,
  ),
  corsOrigin: process.env.CORS_ORIGIN,
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  rootEnvPath,
};
