import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { products } from "../db/schema.js";
import { runSyncCatalog } from "../jobs/syncCatalog.js";

// In-memory, not DB-backed — same reasoning as adminAuthService's
// pendingLogins map: a single-process tool doesn't need this to survive a
// restart, and it only needs to answer "is a sync happening right now".
let running = false;

export function isSyncRunning() {
  return running;
}

export function triggerCatalogSync(): { started: boolean } {
  if (running) return { started: false };
  running = true;
  runSyncCatalog()
    .catch((err) => console.error("[syncStatusService] manual sync failed", err))
    .finally(() => {
      running = false;
    });
  return { started: true };
}

export async function getLastSyncedAt(): Promise<string | null> {
  const [row] = await db.select({ max: sql<string | null>`max(${products.lastSyncedAt})` }).from(products);
  return row?.max ?? null;
}

// Europe/Moscow has been a fixed UTC+3 offset with no DST since 2014, so the
// cron's daily 04:00 Europe/Moscow run (src/index.ts) is always 01:00 UTC —
// no timezone library needed to predict the next occurrence.
export function getNextScheduledSyncAt(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 1, 0, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}
