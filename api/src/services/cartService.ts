import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { cartItems, productVariants, products } from "../db/schema.js";
import { displayName } from "./translationService.js";

export async function getCart(userId: string) {
  const rows = await db
    .select({
      id: cartItems.id,
      qty: cartItems.qty,
      productVariantId: productVariants.id,
      sku: productVariants.sku,
      capacity: productVariants.capacity,
      capacityUnit: productVariants.capacityUnit,
      formatType: productVariants.formatType,
      priceEurCents: productVariants.priceEurCents,
      imageUrl: products.imageUrl,
      inStock: productVariants.inStock,
      productId: products.id,
      productSlug: products.slug,
      productName: products.name,
      productNameRu: products.nameRu,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.productVariantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(cartItems.userId, userId));

  return rows.map(({ productNameRu, ...r }) => ({
    ...r,
    productName: displayName({ name: r.productName, nameRu: productNameRu }),
  }));
}

// Mirrors cartSlice's addLine: merge qty into the existing line if this
// variant is already in the cart, else insert a new one.
export async function addToCart(userId: string, productVariantId: string, qty: number) {
  const existing = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.userId, userId), eq(cartItems.productVariantId, productVariantId)),
  });

  if (existing) {
    await db
      .update(cartItems)
      .set({ qty: existing.qty + qty, updatedAt: new Date() })
      .where(eq(cartItems.id, existing.id));
    return existing.id;
  }

  const [row] = await db.insert(cartItems).values({ userId, productVariantId, qty }).returning({ id: cartItems.id });
  if (!row) throw new Error("Insert returned no cart item row");
  return row.id;
}

export async function setCartItemQty(userId: string, cartItemId: string, qty: number) {
  if (qty <= 0) {
    await db.delete(cartItems).where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)));
    return;
  }
  await db
    .update(cartItems)
    .set({ qty, updatedAt: new Date() })
    .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)));
}

export async function removeCartItem(userId: string, cartItemId: string) {
  await db.delete(cartItems).where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)));
}

// Used after a logged-in checkout completes — the order's items are
// snapshotted into order_items already, the cart itself has nothing left to
// hold onto.
export async function clearCart(userId: string) {
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
}
