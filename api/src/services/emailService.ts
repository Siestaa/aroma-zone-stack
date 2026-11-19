import { and, eq, gt, lt, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { emailOutbox, type orderItems, type orders } from "../db/schema.js";

const API_URL = process.env.UNISENDER_API_URL ?? "https://go2.unisender.ru/ru/transactional/api/v1";
class EmailDeliveryError extends Error {}

export function mailConfigured(): boolean {
  return Boolean(process.env.UNISENDER_API_KEY && process.env.EMAIL_FROM);
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
  message: { recipient: string; subject: string; body: string; replyTo?: string; expiresAt?: Date },
): Promise<void> {
  await connection.insert(emailOutbox).values({
    ...message,
    expiresAt: message.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
}

export async function sendEmail(message: typeof emailOutbox.$inferSelect): Promise<void> {
  if (!mailConfigured()) throw new Error("Email delivery is not configured");
  const response = await fetch(`${API_URL.replace(/\/$/, "")}/email/send.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": process.env.UNISENDER_API_KEY! },
    body: JSON.stringify({ message: {
      recipients: [{ email: message.recipient }],
      from_email: process.env.EMAIL_FROM,
      from_name: process.env.EMAIL_FROM_NAME ?? "Аромазон-тут",
      reply_to: message.replyTo ?? process.env.EMAIL_REPLY_TO,
      subject: message.subject,
      body: { plaintext: message.body },
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

export async function queueOrderConfirmation(connection: Pick<typeof db, "insert">, order: Order, items: OrderItem[]): Promise<void> {
  const lines = items.map((item) => `— ${item.nameSnapshot}${item.capacitySnapshot ? `, ${item.capacitySnapshot}` : ""} × ${item.qty}`);
  await queueEmail(connection, {
    recipient: order.contactEmail,
    subject: "Заказ принят — Аромазон-тут",
    body: `Здравствуйте, ${order.contactName}!\n\nВаш заказ ${order.id} принят.\n\n${lines.join("\n")}\n\n` +
      `К предоплате: ${order.totalRub.toLocaleString("ru-RU")} ₽.\n\n` +
      (order.userId ? "Откройте заказ, нажмите «Оплатить» и следуйте инструкциям. После перевода отметьте «Я оплатил»." : "Свяжитесь с нами для уточнения оплаты заказа.") +
      `\n\n${orderLink(order)}`,
  });
}

export const ORDER_STATUS_MESSAGES = {
  collecting: "Заказ ожидает выкупа",
  paid: "Оплата заказа подтверждена",
  transit: "Заказ в пути",
  delivered: "Заказ доставлен",
} as const;
