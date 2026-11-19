import { and, eq, gt, lt, lte } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db } from "../db/client.js";
import { emailOutbox, type orderItems, type orders } from "../db/schema.js";

import { getEmailTemplate, type EmailConnection } from "./emailTemplateService.js";
import { renderEmailTemplate, shortOrderNumber, safeEmailUrl, type EmailTemplateKey } from "./emailTemplates.js";

const API_URL = process.env.UNISENDER_API_URL ?? "https://go2.unisender.ru/ru/transactional/api/v1";
class EmailDeliveryError extends Error {}

export function mailConfigured(): boolean {
  if (!process.env.EMAIL_FROM?.trim()) return false;
  const transport = process.env.EMAIL_TRANSPORT ?? "unisender";
  if (transport === "smtp") {
    const port = Number(process.env.SMTP_PORT ?? "587");
    return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD)
      && Number.isInteger(port) && port > 0 && port <= 65535
      && [undefined, "true", "false"].includes(process.env.SMTP_SECURE);
  }
  return transport === "unisender" && Boolean(process.env.UNISENDER_API_KEY?.trim());
}

export function publicWebUrl(): URL {
  const url = new URL(process.env.PUBLIC_WEB_URL ?? "https://xn--80aavshcdl.xn--p1ai");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("PUBLIC_WEB_URL must use HTTPS in production");
  }
  return url;
}

export async function queueEmail(
  connection: Pick<typeof db, "insert">,
  message: { recipient: string; subject: string; body: string; html?: string; replyTo?: string; expiresAt?: Date },
): Promise<void> {
  await connection.insert(emailOutbox).values({
    ...message,
    expiresAt: message.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
}

export async function sendEmail(message: typeof emailOutbox.$inferSelect): Promise<void> {
  if (!mailConfigured()) throw new Error("Email delivery is not configured");
  if (process.env.EMAIL_TRANSPORT === "smtp") {
    await sendSmtpEmail(message);
    return;
  }
  const response = await fetch(`${API_URL.replace(/\/$/, "")}/email/send.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": process.env.UNISENDER_API_KEY! },
    body: JSON.stringify({ message: {
      recipients: [{ email: message.recipient }],
      from_email: process.env.EMAIL_FROM,
      from_name: process.env.EMAIL_FROM_NAME ?? "Аромазон-тут",
      reply_to: message.replyTo ?? process.env.EMAIL_REPLY_TO,
      subject: message.subject,
      body: { plaintext: message.body,
      html: message.html ?? undefined, ...(message.html ? { html: message.html } : {}) },
      template_engine: "none",
      global_language: "ru",
      idempotence_key: message.id,
    } }),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json() as { status?: string; code?: number; emails?: string[]; failed_emails?: Record<string, string> };
  const recipient = message.recipient.toLowerCase();
  const accepted = result.emails?.some((email) => email.toLowerCase() === recipient);
  const rejected = Object.keys(result.failed_emails ?? {}).some((email) => email.toLowerCase() === recipient);
  if (!response.ok || result.status !== "success" || !accepted || rejected) {
    // Provider responses may contain addresses or message content. Log only codes.
    const code = typeof result.code === "number" ? result.code : "unknown";
    throw new EmailDeliveryError(`Unisender HTTP ${response.status}, code ${code}`);
  }
}

async function sendSmtpEmail(message: typeof emailOutbox.$inferSelect): Promise<void> {
  const port = Number(process.env.SMTP_PORT ?? "587");
  const secure = process.env.SMTP_SECURE === undefined ? port === 465 : process.env.SMTP_SECURE === "true";
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port,
    secure,
    requireTLS: !secure,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({
      from: { name: process.env.EMAIL_FROM_NAME ?? "Аромазон-тут", address: process.env.EMAIL_FROM! },
      to: { address: message.recipient, name: "" },
      replyTo: message.replyTo ?? process.env.EMAIL_REPLY_TO,
      subject: message.subject,
      text: message.body,
      html: message.html ?? undefined,
      messageId: `<${message.id}@${process.env.EMAIL_FROM!.split("@").at(-1)}>`,
    });
    if (!result.accepted.some((address) => String(address).toLowerCase() === message.recipient.toLowerCase())) {
      throw new EmailDeliveryError("SMTP recipient was not accepted");
    }
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    // SMTP errors can include private addresses and message content.
    const code = (error as { responseCode?: unknown })?.responseCode;
    throw new EmailDeliveryError(`SMTP delivery failed, response ${typeof code === "number" ? code : "unavailable"}`);
  } finally {
    transport.close();
  }
}

export async function processEmailQueue(): Promise<void> {
  await db.delete(emailOutbox).where(lte(emailOutbox.expiresAt, new Date()));
  if (!mailConfigured()) return;
  for (let index = 0; index < 10; index++) {
    const processed = await db.transaction(async (tx) => {
      const [message] = await tx.select().from(emailOutbox)
        .where(and(lte(emailOutbox.nextAttemptAt, new Date()), gt(emailOutbox.expiresAt, new Date()), lt(emailOutbox.attempts, 8)))
        .orderBy(emailOutbox.nextAttemptAt).limit(1).for("update", { skipLocked: true });
      if (!message) return false;
      try {
        await sendEmail(message);
        await tx.delete(emailOutbox).where(eq(emailOutbox.id, message.id));
      } catch (error) {
        const attempts = message.attempts + 1;
        await tx.update(emailOutbox).set({
          attempts,
          nextAttemptAt: new Date(Date.now() + Math.min(3600, 60 * 2 ** message.attempts) * 1000),
        }).where(eq(emailOutbox.id, message.id));
        const reason = error instanceof EmailDeliveryError ? error.message : "Network or response error";
        console.warn(`[email] Delivery attempt ${attempts} failed for queue item ${message.id}: ${reason}`);
      }
      return true;
    });
    if (!processed) break;
  }
}

type Order = typeof orders.$inferSelect;
type OrderItem = typeof orderItems.$inferSelect;

export function orderLink(order: Order): string {
  return new URL(order.userId ? `/account/orders/${order.id}` : "/contacts", publicWebUrl()).href;
}

export function orderEmailVariables(order: Order, items: OrderItem[] = []) {
  return {
    name: order.contactName,
    email: order.contactEmail,
    order_number: shortOrderNumber(order.id),
    total: order.totalRub.toLocaleString("ru-RU"),
    items: items.map(item => `— ${item.nameSnapshot}${item.capacitySnapshot ? `, ${item.capacitySnapshot}` : ""} × ${item.qty}`).join("\n"),
    payment_instructions: order.userId
      ? "Откройте заказ, нажмите «Оплатить» и следуйте инструкциям. После перевода отметьте «Я оплатил»."
      : "Свяжитесь с нами для уточнения оплаты заказа.",
  };
}
export function adminOrderLink(order: Order): string {
  const base = process.env.ADMIN_ORIGIN?.split(",")[0]?.trim() || "https://admin.xn--80aavshcdl.xn--p1ai";
  return safeEmailUrl(new URL(`/orders/${order.id}`, base).href)!;
}
export async function queueTemplatedEmail(
  connection: EmailConnection,
  key: EmailTemplateKey,
  message: { recipient: string; variables: Record<string, string>; actionUrl?: string; replyTo?: string; expiresAt?: Date },
): Promise<void> {
  const template = await getEmailTemplate(key, connection);
  const rendered = renderEmailTemplate(template, message.variables, message.actionUrl);
  await queueEmail(connection, { recipient: message.recipient, replyTo: message.replyTo, expiresAt: message.expiresAt, ...rendered });
}
export async function queueOrderConfirmation(connection: EmailConnection, order: Order, items: OrderItem[]): Promise<void> {
  await queueTemplatedEmail(connection, "order_confirmation", {
    recipient: order.contactEmail, variables: orderEmailVariables(order, items), actionUrl: orderLink(order),
  });
}
