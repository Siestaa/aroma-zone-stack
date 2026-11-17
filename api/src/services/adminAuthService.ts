import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import * as argon2 from "argon2";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import { db } from "../db/client.js";
import { adminSessions, adminUsers } from "../db/schema.js";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — shorter than the storefront's 30 days, staff tool
const TOTP_ISSUER = "аромазон-тут admin";

export class AdminAuthError extends Error {}

export async function verifyAdminCredentials(email: string, password: string) {
  const admin = await db.query.adminUsers.findFirst({ where: eq(adminUsers.email, email) });
  if (!admin) throw new AdminAuthError("Неверный email или пароль");

  const valid = await argon2.verify(admin.passwordHash, password);
  if (!valid) throw new AdminAuthError("Неверный email или пароль");

  return admin;
}

export async function createAdminSession(adminUserId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(adminSessions).values({ token, adminUserId, expiresAt });
  return { token, expiresAt };
}

export async function destroyAdminSession(token: string) {
  await db.delete(adminSessions).where(eq(adminSessions.token, token));
}

export async function getAdminBySessionToken(token: string) {
  const session = await db.query.adminSessions.findFirst({ where: eq(adminSessions.token, token) });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await destroyAdminSession(token);
    return null;
  }
  const admin = await db.query.adminUsers.findFirst({ where: eq(adminUsers.id, session.adminUserId) });
  return admin ?? null;
}

// A short-lived signed-in-but-not-yet-2FA-verified token — kept in memory,
// not the DB, since it only needs to survive the few seconds between the
// password step and the TOTP step of one login attempt.
const pendingLogins = new Map<string, { adminUserId: string; expiresAt: number }>();
const PENDING_TTL_MS = 5 * 60 * 1000;

export function createPendingLogin(adminUserId: string) {
  const pendingToken = randomBytes(24).toString("hex");
  pendingLogins.set(pendingToken, { adminUserId, expiresAt: Date.now() + PENDING_TTL_MS });
  return pendingToken;
}

export function resolvePendingLogin(pendingToken: string): string | null {
  const entry = pendingLogins.get(pendingToken);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pendingLogins.delete(pendingToken);
    return null;
  }
  return entry.adminUserId;
}

export function consumePendingLogin(pendingToken: string) {
  pendingLogins.delete(pendingToken);
}

// TOTP setup happens on first login (no totpSecret yet): generate a secret,
// return it as a QR code, but don't flip totpEnabled until the admin proves
// they've actually saved it by submitting one valid code back.
export async function startTotpSetup(adminUserId: string, email: string) {
  const secret = generateSecret();
  await db.update(adminUsers).set({ totpSecret: secret }).where(eq(adminUsers.id, adminUserId));
  const otpauthUrl = generateURI({ issuer: TOTP_ISSUER, label: email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, qrDataUrl };
}

export async function confirmTotpSetup(adminUserId: string, code: string) {
  const admin = await db.query.adminUsers.findFirst({ where: eq(adminUsers.id, adminUserId) });
  if (!admin?.totpSecret) throw new AdminAuthError("Настройка 2FA ещё не начата");
  if (!(await verifyTotpCode(admin.totpSecret, code))) throw new AdminAuthError("Неверный код");
  await db.update(adminUsers).set({ totpEnabled: true }).where(eq(adminUsers.id, adminUserId));
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const result = await verifyTotp({ secret, token: code });
  return result.valid;
}

// Re-binding 2FA to a new device (Settings page, already-logged-in admin —
// distinct from startTotpSetup's first-login flow). The new secret is kept
// in memory only until proven working, same reasoning as pendingLogins: if
// this overwrote admin_users.totpSecret immediately, an admin who scans the
// QR but never completes the confirm step (closes the tab, mistypes,
// whatever) would lock themselves out — their old device's codes would stop
// matching a secret that was never actually confirmed. The old device keeps
// working right up until a valid code from the new one is submitted.
const pendingTotpResets = new Map<string, { secret: string; expiresAt: number }>();
const PENDING_RESET_TTL_MS = 10 * 60 * 1000;

export async function startTotpReset(adminUserId: string, email: string) {
  const secret = generateSecret();
  pendingTotpResets.set(adminUserId, { secret, expiresAt: Date.now() + PENDING_RESET_TTL_MS });
  const otpauthUrl = generateURI({ issuer: TOTP_ISSUER, label: email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { qrDataUrl };
}

export async function confirmTotpReset(adminUserId: string, code: string) {
  const entry = pendingTotpResets.get(adminUserId);
  if (!entry || entry.expiresAt < Date.now()) {
    pendingTotpResets.delete(adminUserId);
    throw new AdminAuthError("Сначала отсканируйте новый QR-код — время на подтверждение истекло");
  }
  if (!(await verifyTotpCode(entry.secret, code))) throw new AdminAuthError("Неверный код");

  await db.update(adminUsers).set({ totpSecret: entry.secret, totpEnabled: true }).where(eq(adminUsers.id, adminUserId));
  pendingTotpResets.delete(adminUserId);
}
