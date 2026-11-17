import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { orders, orderStatusEnum } from "../db/schema.js";

const PAGE_SIZE = 30;

export interface ListOrdersParams {
  status?: (typeof orderStatusEnum.enumValues)[number];
  // Matches contact name, email, phone, or the order id itself — the
  // handful of fields staff realistically have on hand when a customer
  // calls in asking about their order.
  query?: string;
  page?: number;
}

export async function listOrders(params: ListOrdersParams) {
  const page = params.page && params.page > 1 ? params.page : 1;

  const conditions = [];
  if (params.status) conditions.push(eq(orders.status, params.status));
  if (params.query?.trim()) {
    const q = `%${params.query.trim()}%`;
    conditions.push(
      or(
        ilike(orders.contactName, q),
        ilike(orders.contactEmail, q),
        ilike(orders.contactPhone, q),
        sql`${orders.id}::text ilike ${q}`
      )
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rowsQuery = db.query.orders.findMany({
    where,
    orderBy: desc(orders.createdAt),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    with: { items: true },
  });

  const countQuery = db.select({ count: sql<number>`count(*)` }).from(orders).where(where ?? sql`true`);

  const [rows, [countRow]] = await Promise.all([rowsQuery, countQuery]);
  const totalCount = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return { rows, totalCount, totalPages, currentPage: Math.min(page, totalPages), pageSize: PAGE_SIZE };
}

// Staff need to look the item up on Aroma-Zone's own site (photo, original
// French name, source link) when handling an order by hand — order_items
// only snapshots the fields that must stay financially accurate forever
// (sku/name/price/capacity, see schema.ts), not the photo/original name, so
// those come from a *live* join through productVariantId instead. That FK
// is nullable (`onDelete: set null`) precisely so old orders keep working
// after a variant is removed from the catalog — items.product is just null
// for those rows, degrading gracefully rather than erroring.
export async function getOrderById(id: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      items: {
        with: {
          productVariant: {
            columns: { formatType: true },
            with: {
              product: { columns: { slug: true, name: true, imageUrl: true } },
            },
          },
        },
      },
    },
  });
  if (!order) return order;

  return {
    ...order,
    items: order.items.map(({ productVariant, ...item }) => ({
      ...item,
      product: productVariant?.product ?? null,
      // Same capacity can mean two physically different SKUs (glass bottle
      // vs eco-refill, differently priced) — nameSnapshot/capacitySnapshot
      // alone can't tell them apart, so staff packing the order (or a
      // customer who ordered both) sees two identical-looking lines with
      // no explanation for the price difference. formatType disambiguates;
      // null for the ~most variants that don't need it (see schema.ts).
      formatType: productVariant?.formatType ?? null,
    })),
  };
}

// Drives the admin orders list's "Новый" badge (see schema.ts's
// viewedByAdminAt comment) — called from the GET /orders/:id route handler,
// the one place that actually represents staff drilling into an order, not
// from getOrderById itself (that's also reused by updateOrderStatus/
// updateOrderTrackingUrl, which shouldn't need their own side effect here).
// The `is null` guard keeps this a single write per order rather than
// touching the row on every subsequent open.
export async function markOrderViewedByAdmin(id: string): Promise<void> {
  await db
    .update(orders)
    .set({ viewedByAdminAt: new Date() })
    .where(and(eq(orders.id, id), sql`${orders.viewedByAdminAt} is null`));
}

export class AdminOrderError extends Error {}

// Returns the full order shape (with items) rather than just the updated
// row — the admin frontend replaces its cached order wholesale with this
// response, and that cache already has `items` loaded from the initial
// GET; returning a bare row here would blow that away and crash the
// items list render.
export async function updateOrderStatus(id: string, status: (typeof orderStatusEnum.enumValues)[number]) {
  const [order] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning({ id: orders.id });
  if (!order) throw new AdminOrderError("Заказ не найден");
  return getOrderById(order.id);
}

// null clears the link (customer-facing "Отследить посылку" button just
// stops showing) — same full-shape-response reasoning as updateOrderStatus.
export async function updateOrderTrackingUrl(id: string, trackingUrl: string | null) {
  const [order] = await db.update(orders).set({ trackingUrl }).where(eq(orders.id, id)).returning({ id: orders.id });
  if (!order) throw new AdminOrderError("Заказ не найден");
  return getOrderById(order.id);
}
