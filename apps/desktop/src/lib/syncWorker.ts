/**
 * M4 Batch D — one-way outbound flush worker (TypeScript webview).
 * Interval 15s; POST /api/v1/sync/ingest; pause while Force Offline or not online.
 * Not a Rust HTTP client (tokens live in localStorage).
 */

import type { SyncEvent, SyncIngestResult } from "@r2a/shared-types";
import { apiRequest, ApiError } from "@/lib/api";
import {
  countSyncDead,
  countUnsynced,
  listSyncPending,
  markSyncAttempt,
  markSyncDead,
  markSyncSynced,
} from "@/lib/localDb/client";
import type { SyncQueueRow } from "@/lib/localDb/types";
import type { ConnectivityMode } from "@/features/shell/connectivityTypes";

export const SYNC_FLUSH_INTERVAL_MS = 15_000;
export const SYNC_FLUSH_BATCH_SIZE = 10;
export const SYNC_MAX_TRANSIENT_ATTEMPTS = 8;
export const SYNC_BACKOFF_CAP_MS = 240_000;

/** Matches `@r2a/shared-types` sync enums. Value imports from that CJS dist break Vite. */
const SYNC_ENTITY_TYPES = ["sale", "stock_delta", "product", "customer"] as const;
const SYNC_ACTIONS = ["create", "update", "delete"] as const;
type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];
type SyncAction = (typeof SYNC_ACTIONS)[number];

function isSyncEntityType(value: string): value is SyncEntityType {
  return (SYNC_ENTITY_TYPES as readonly string[]).includes(value);
}

function isSyncAction(value: string): value is SyncAction {
  return (SYNC_ACTIONS as readonly string[]).includes(value);
}

export type SyncIngestPostBody = {
  events: Array<{
    event_id: string;
    entity_type: string;
    action: string;
    payload: Record<string, unknown>;
    created_at?: string;
  }>;
};

export type SyncIngestPost = (
  body: SyncIngestPostBody,
) => Promise<SyncIngestResult>;

export type FlushSyncDeps = {
  listSyncPending?: (limit?: number) => Promise<SyncQueueRow[]>;
  markSyncSynced?: (id: string) => Promise<void>;
  markSyncAttempt?: (id: string, lastError: string) => Promise<void>;
  markSyncDead?: (id: string, lastError: string) => Promise<void>;
  countUnsynced?: () => Promise<number>;
  countSyncDead?: () => Promise<number>;
  postIngest?: SyncIngestPost;
  nowMs?: () => number;
  onWillPost?: () => void;
};

export type FlushSyncResult = {
  skipped: "empty" | "backoff" | null;
  posted: number;
  accepted: number;
  duplicate: number;
  rejected: number;
  lastTickFailed: boolean;
  authFailed: boolean;
  pendingCount: number;
  deadCount: number;
};

export function shouldPauseSyncWorker(args: {
  forcedOffline: boolean;
  mode: ConnectivityMode;
}): boolean {
  return args.forcedOffline || args.mode !== "online";
}

export function syncBackoffMs(attemptCount: number): number {
  if (attemptCount <= 0) return 0;
  return Math.min(
    SYNC_FLUSH_INTERVAL_MS * 2 ** (attemptCount - 1),
    SYNC_BACKOFF_CAP_MS,
  );
}

export function isSyncRowInBackoff(
  row: SyncQueueRow,
  nowMs = Date.now(),
): boolean {
  if (row.attemptCount <= 0 || !row.lastAttemptAt) return false;
  const last = Date.parse(row.lastAttemptAt);
  if (!Number.isFinite(last)) return false;
  return nowMs - last < syncBackoffMs(row.attemptCount);
}

/** Consecutive ready rows from the FIFO head (head-of-line backoff). */
export function selectReadyPrefix(
  rows: SyncQueueRow[],
  nowMs = Date.now(),
): SyncQueueRow[] {
  const ready: SyncQueueRow[] = [];
  for (const row of rows) {
    if (isSyncRowInBackoff(row, nowMs)) break;
    ready.push(row);
  }
  return ready;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function isAuthFailure(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.statusCode === 401 || err.statusCode === 403)
  );
}

function isTransientFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    const code = err.statusCode;
    if (code === 408 || code === 429) return true;
    return code >= 500;
  }
  return true;
}

async function defaultPostIngest(
  body: SyncIngestPostBody,
): Promise<SyncIngestResult> {
  return apiRequest<SyncIngestResult>("/api/v1/sync/ingest", {
    method: "POST",
    body,
  });
}

function toSyncEvent(row: SyncQueueRow): SyncEvent | null {
  if (!isSyncEntityType(row.entityType) || !isSyncAction(row.action)) {
    return null;
  }
  const created = row.createdAt ? new Date(row.createdAt) : undefined;
  return {
    event_id: row.id,
    entity_type: row.entityType,
    action: row.action,
    payload: row.payload,
    created_at:
      created && Number.isFinite(created.getTime()) ? created : undefined,
  };
}

async function counts(
  deps: Required<Pick<FlushSyncDeps, "countUnsynced" | "countSyncDead">>,
): Promise<{ pendingCount: number; deadCount: number }> {
  let pendingCount = 0;
  let deadCount = 0;
  try {
    pendingCount = await deps.countUnsynced();
  } catch {
    pendingCount = 0;
  }
  try {
    deadCount = await deps.countSyncDead();
  } catch {
    deadCount = 0;
  }
  return { pendingCount, deadCount };
}

/**
 * One FIFO tick: up to 10 pending events → POST /api/v1/sync/ingest.
 * accepted/duplicate → synced; rejected → dead; transport/5xx → head attempt + break.
 */
export async function flushSyncQueue(
  deps: FlushSyncDeps = {},
): Promise<FlushSyncResult> {
  const list = deps.listSyncPending ?? listSyncPending;
  const markSynced = deps.markSyncSynced ?? markSyncSynced;
  const markAttempt = deps.markSyncAttempt ?? markSyncAttempt;
  const markDead = deps.markSyncDead ?? markSyncDead;
  const countPending = deps.countUnsynced ?? countUnsynced;
  const countDead = deps.countSyncDead ?? countSyncDead;
  const postIngest = deps.postIngest ?? defaultPostIngest;
  const nowMs = deps.nowMs ?? Date.now;
  const countDeps = {
    countUnsynced: countPending,
    countSyncDead: countDead,
  };

  const emptyBase = async (
    skipped: FlushSyncResult["skipped"],
  ): Promise<FlushSyncResult> => {
    const c = await counts(countDeps);
    return {
      skipped,
      posted: 0,
      accepted: 0,
      duplicate: 0,
      rejected: 0,
      lastTickFailed: false,
      authFailed: false,
      ...c,
    };
  };

  const pending = await list(SYNC_FLUSH_BATCH_SIZE);
  if (pending.length === 0) return emptyBase("empty");

  const ready: SyncQueueRow[] = [];
  for (const row of pending) {
    if (isSyncRowInBackoff(row, nowMs())) break;
    const event = toSyncEvent(row);
    if (!event) {
      await markDead(
        row.id,
        `unsupported entity_type/action: ${row.entityType}/${row.action}`,
      );
      continue;
    }
    ready.push(row);
  }

  if (ready.length === 0) {
    const remaining = await list(SYNC_FLUSH_BATCH_SIZE);
    if (remaining.length > 0 && isSyncRowInBackoff(remaining[0]!, nowMs())) {
      return emptyBase("backoff");
    }
    return emptyBase("empty");
  }

  const events = ready
    .map((row) => toSyncEvent(row))
    .filter((e): e is SyncEvent => e != null);

  deps.onWillPost?.();

  try {
    const data = await postIngest({
      events: events.map((e) => ({
        event_id: e.event_id,
        entity_type: e.entity_type,
        action: e.action,
        payload: e.payload,
        created_at: e.created_at
          ? e.created_at.toISOString()
          : undefined,
      })),
    });
    const results = Array.isArray(data?.results) ? data.results : [];
    let accepted = 0;
    let duplicate = 0;
    let rejected = 0;

    for (const event of events) {
      const result = results.find((r) => r.eventId === event.event_id);
      if (!result) continue;
      if (result.status === "accepted") {
        await markSynced(event.event_id);
        accepted += 1;
      } else if (result.status === "duplicate") {
        await markSynced(event.event_id);
        duplicate += 1;
      } else if (result.status === "rejected") {
        await markDead(event.event_id, result.message ?? "rejected");
        rejected += 1;
      }
    }

    const c = await counts(countDeps);
    return {
      skipped: null,
      posted: events.length,
      accepted,
      duplicate,
      rejected,
      lastTickFailed: false,
      authFailed: false,
      ...c,
    };
  } catch (err) {
    const head = ready[0];
    if (!head) {
      const c = await counts(countDeps);
      return {
        skipped: null,
        posted: 0,
        accepted: 0,
        duplicate: 0,
        rejected: 0,
        lastTickFailed: true,
        authFailed: isAuthFailure(err),
        ...c,
      };
    }

    if (isAuthFailure(err)) {
      const c = await counts(countDeps);
      return {
        skipped: null,
        posted: events.length,
        accepted: 0,
        duplicate: 0,
        rejected: 0,
        lastTickFailed: true,
        authFailed: true,
        ...c,
      };
    }

    const msg = errorMessage(err, "sync ingest failed");
    if (isTransientFailure(err)) {
      await markAttempt(head.id, msg);
      const nextAttempts = head.attemptCount + 1;
      if (nextAttempts >= SYNC_MAX_TRANSIENT_ATTEMPTS) {
        await markDead(head.id, msg);
      }
    } else {
      await markDead(head.id, msg);
    }

    const c = await counts(countDeps);
    return {
      skipped: null,
      posted: events.length,
      accepted: 0,
      duplicate: 0,
      rejected: 0,
      lastTickFailed: true,
      authFailed: false,
      ...c,
    };
  }
}

export function bindFlushNowHelper(
  flush: () => Promise<void>,
): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as Window & {
    __r2aFlushSyncNow?: () => Promise<void>;
  };
  const fn = () => flush();
  w.__r2aFlushSyncNow = fn;
  return () => {
    if (w.__r2aFlushSyncNow === fn) {
      delete w.__r2aFlushSyncNow;
    }
  };
}
