import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { orderItems, orders, productVariants } from "../db/schema.js";
import { sendOrderConfirmationEmail } from "./emailService.js";
import { getCurrentFxRate, getHelperFeeRub, SettingsError } from "./settingsService.js";
import { displayName } from "./translationService.js";

export class OrderError extends Error {}

export interface CreateOrderInput {
  userId: string | null;
  items: Array<{ productVariantId: string; qty: number }>;
  // "pickup"/"post" only reachable via old clients or a hand-crafted
  // request — the checkout form only ever submits "cdek" now (self-pickup
  // and Почта России were both retired). Validated the same as "cdek"
  // below (needs an address) rather than special-cased, so nothing breaks
  // if either somehow still arrives.
  fulfillment: "pickup" | "post" | "cdek";
  city?: string;
  address?: string;
  comment?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

export async function createOrder(input: CreateOrderInput) {
  if (input.items.length === 0) throw new OrderError("Корзина пуста");
  if (input.fulfillment !== "pickup" && (!input.city?.trim() || !input.address?.trim())) {
    throw new OrderError("Укажите город и адрес доставки");
  }

  const variantIds = input.items.map((i) => i.productVariantId);
  const variants = await db.query.productVariants.findMany({
    where: inArray(productVariants.id, variantIds),
    with: { product: true },
  });
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const lineItems = input.items.map((item) => {
    const variant = variantById.get(item.productVariantId);
    if (!variant) throw new OrderError(`Товар недоступен: ${item.productVariantId}`);
    return { item, variant };
  });

  const subtotalEurCents = lineItems.reduce((sum, { item, variant }) => sum + variant.priceEurCents * item.qty, 0);
  const fxRate = await getCurrentFxRate();
  // A flat per-order service fee (what we pay our fulfillment helpers,
  // "феям-помощницам") — IS part of totalRub, prepaid by the customer along
  // with the items. Separate from the actual CDEK courier charge, which the
  // customer pays directly to the courier on receipt and never goes through
  // us at all (see schema.ts's helperFeeRub comment for the full picture).
  const helperFeeRub = await getHelperFeeRub();
  const totalRub = Math.round((subtotalEurCents / 100) * fxRate) + helperFeeRub;

  const [order] = await db
    .insert(orders)
    .values({
      userId: input.userId,
      fulfillment: input.fulfillment,
      city: input.city ?? null,
      address: input.address ?? null,
      comment: input.comment ?? null,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      subtotalEurCents,
      fxRateUsed: fxRate.toFixed(4),
      helperFeeRub,
      totalRub,
    })
    .returning();
  if (!order) throw new Error("Insert returned no order row");

  const insertedItems = await db
    .insert(orderItems)
    .values(
      lineItems.map(({ item, variant }) => ({
        orderId: order.id,
        productVariantId: variant.id,
        skuSnapshot: variant.sku,
        nameSnapshot: displayName(variant.product),
        priceEurCentsSnapshot: variant.priceEurCents,
        capacitySnapshot: variant.capacity ? `${variant.capacity} ${variant.capacityUnit ?? ""}`.trim() : null,
        qty: item.qty,
      }))
    )
    .returning();

  // Best-effort — a failed send must not fail order creation, the order is
  // already committed above. See emailService.ts.
  void sendOrderConfirmationEmail(order, insertedItems);

  return order;
}

export async function listMyOrders(userId: string) {
  return db.query.orders.findMany({
    where: eq(orders.userId, userId),
    orderBy: desc(orders.createdAt),
    with: { items: true },
  });
}

// Scoped to userId (not just id) — this is the customer-facing detail page
// (/account/orders/[id]), so ownership is enforced at the query itself
// rather than fetched-then-checked, same defense-in-depth spirit as the
// rest of this file's auth boundary.
export async function getMyOrderById(userId: string, orderId: string) {
  return db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
    with: { items: true },
  });
}

// Records the customer's own "I sent the money" claim from the "Оплатить"
// modal — see schema.ts's customerMarkedPaidAt comment for why this never
// touches `status` itself. Idempotent: clicking it again just refreshes the
// timestamp, no harm done.
export async function markOrderPaidByCustomer(userId: string, orderId: string) {
  const [updated] = await db
    .update(orders)
    .set({ customerMarkedPaidAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .returning({ id: orders.id });
  if (!updated) return null;
  return getMyOrderById(userId, updated.id);
}
