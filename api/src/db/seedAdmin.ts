// Creates (or resets the password of) an admin_users row — there is no
// public admin registration endpoint by design (see api/CLAUDE.md-to-be:
// admin accounts are staff-only, provisioned by hand). 2FA is set up
// separately on that admin's first login (adminAuthService.startTotpSetup).
//
// Usage: tsx src/db/seedAdmin.ts <email> <password>
import "dotenv/config";
import * as argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db, pool } from "./client.js";
import { adminUsers } from "./schema.js";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: tsx src/db/seedAdmin.ts <email> <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password);
  const existing = await db.query.adminUsers.findFirst({ where: eq(adminUsers.email, email) });

  if (existing) {
    // Resetting the password also resets 2FA — otherwise a lost password
    // combined with a still-enabled TOTP secret would permanently lock the
    // account out (no recovery flow exists for an internal single-admin tool).
    await db
      .update(adminUsers)
      .set({ passwordHash, totpSecret: null, totpEnabled: false })
      .where(eq(adminUsers.id, existing.id));
    console.log(`Password reset for ${email} — 2FA will be re-set-up on next login.`);
  } else {
    await db.insert(adminUsers).values({ email, passwordHash });
    console.log(`Admin user created: ${email}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
