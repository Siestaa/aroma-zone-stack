import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

export async function allowRequest(scope: string, identity: string, limit: number): Promise<boolean> {
  const key = createHash("sha256").update(`${scope}:${identity}`).digest("hex");
  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO request_limits (key, count, expires_at)
    VALUES (${key}, 1, now() + interval '1 hour')
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN request_limits.expires_at <= now() THEN 1 ELSE request_limits.count + 1 END,
      expires_at = CASE WHEN request_limits.expires_at <= now() THEN now() + interval '1 hour' ELSE request_limits.expires_at END
    RETURNING count
  `);
  return Number(result.rows[0]?.count) <= limit;
}
