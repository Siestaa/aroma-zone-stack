import { Resend } from "resend";
import type { orderItems, orders } from "../db/schema.js";

// Order-confirmation email, sent best-effort right after checkout — see
// orderService.ts's createOrder. Optional by design: RESEND_API_KEY unset
// (e.g. no key configured yet, or intentionally disabled) just skips
// sending, same "off until configured" convention as CATALOG_SYNC_PROXY in
// proxyDispatcher.ts. A send failure (bad key, Resend outage, recipient
// rejected) is logged and swallowed, never thrown — losing a confirmation
// email must not lose the order itself, which is already committed to the
// DB by the time this runs.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Resend's own shared sandbox address — works with zero setup, but Resend
// only lets it deliver to the email the API key's account was created
// with, not arbitrary customer addresses. Swap EMAIL_FROM to a verified
// address on our own domain once one exists (see Resend's domain
// verification) to actually reach real customers.
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "аромазон-тут <onboarding@resend.dev>";

// Base URL for the "Мои заказы" link in the email body — e.g.
// "http://155.212.219.102" during this no-domain-yet phase, the real
// https://<domain> once one exists. No link is included if unset.
const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL;

type Order = typeof orders.$inferSelect;
type OrderItem = typeof orderItems.$inferSelect;

function formatRub(rub: number): string {
  return `${rub.toLocaleString("ru-RU")} ₽`;
}

function renderOrderEmailText(order: Order, items: OrderItem[]): string {
  const lines = items.map((item) => {
    const capacity = item.capacitySnapshot ? `, ${item.capacitySnapshot}` : "";
    return `— ${item.nameSnapshot}${capacity} × ${item.qty}`;
  });

  const orderLink = PUBLIC_WEB_URL ? `\n\nСмотреть заказ: ${PUBLIC_WEB_URL}/account/orders/${order.id}` : "";

  return (
    `Здравствуйте, ${order.contactName}!\n\n` +
    `Ваш заказ принят и ждёт подтверждения.\n\n` +
    `Состав заказа:\n${lines.join("\n")}\n\n` +
    `К предоплате: ${formatRub(order.totalRub)}\n\n` +
    `Чтобы оплатить — откройте «Мои заказы» на сайте, зайдите в этот заказ, нажмите «Оплатить», ` +
    `переведите сумму по показанным реквизитам и отметьте «Я оплатил». Заказ уходит в закупку ` +
    `после того, как мы подтвердим поступление денег.${orderLink}`
  );
}

export async function sendOrderConfirmationEmail(order: Order, items: OrderItem[]): Promise<void> {
  if (!resend) return;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: order.contactEmail,
      subject: "Заказ принят — аромазон-тут",
      text: renderOrderEmailText(order, items),
    });
    if (error) console.warn(`[emailService] send failed for order ${order.id}: ${error.message}`);
  } catch (err) {
    console.warn(`[emailService] send failed for order ${order.id}: ${(err as Error).message}`);
  }
}
