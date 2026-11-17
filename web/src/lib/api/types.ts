// Shapes returned by the real backend (api/), replacing lib/mock/types.ts.
// Prices travel as integer EUR cents everywhere except the display-only
// `approxRub` fields, which the API computes live from the current FX rate
// (see api/src/services/settingsService.ts) — never store/cache approxRub
// across requests, always take it fresh from the response.

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  // The untranslated French original — shown as a subtitle under `name`
  // once translated (equal to `name` itself until then, see
  // api/src/services/translationService.ts).
  nameOriginal: string;
  bio: boolean;
  bestSeller: boolean;
  ratingAvg: number | null;
  ratingCount: number | null;
  minPriceEurCents: number;
  approxRub: number;
  inStock: boolean;
  imageUrl: string | null;
  // Cheapest variant's formatType (same convention as imageUrl above) — see
  // ProductVariant's comment. Null for the vast majority of products.
  formatType: string | null;
  // The cheapest variant's own identity — lets a catalog/favorites card
  // add straight to the cart (see ProductQuickAdd) without a second fetch.
  // Same "cheapest wins" convention as formatType, so it can point at an
  // out-of-stock variant if a pricier size is the one actually in stock —
  // quick-add only renders while the product's overall `inStock` is true.
  defaultVariantId: string;
  defaultVariantSku: string;
  defaultVariantCapacity: number | null;
  defaultVariantCapacityUnit: string | null;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  capacity: number | null;
  capacityUnit: string | null;
  // AZ's own per-variant format/color/scent label ("flacon-verre",
  // "eco-recharge", "ambre", ...) — only backfilled for the handful of
  // products where two variants share a capacity and this is the only real
  // way to tell them apart (see api/CLAUDE.md and schema.ts). Null for the
  // vast majority of variants; run through `formatTypeLabel` before display.
  formatType: string | null;
  priceEurCents: number;
  approxRub: number;
  imageUrl: string | null;
  inStock: boolean;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  nameOriginal: string;
  description: string;
  familleTechnique: string;
  bio: boolean;
  bestSeller: boolean;
  ratingAvg: number | null;
  ratingCount: number | null;
  isAnyVariantInStock: boolean;
  variants: ProductVariant[];
  fxRate: number;
  // The product-type categories this product matches (see api/CLAUDE.md —
  // a product can belong to several; no single "primary" category exists
  // in this data model).
  categories: { slug: string; name: string }[];
}

export interface Category {
  slug: string;
  name: string;
  count: number;
}

export interface ProductsResponse {
  products: ProductListItem[];
  pagination: { page: number; totalPages: number; totalCount: number; pageSize: number };
}

// Client-side cart line (Redux) — one entry per product variant, fully
// denormalized so the cart/checkout UI never needs an extra fetch to render.
export interface CartLine {
  productVariantId: string;
  productSlug: string;
  productName: string;
  sku: string;
  capacity: number | null;
  capacityUnit: string | null;
  // Same capacity can mean two physically different SKUs (glass bottle vs
  // eco-refill, differently priced, see ProductVariant's comment) — without
  // this, two such lines look identical except for price, with no
  // explanation why. Null for the vast majority of variants.
  formatType: string | null;
  priceEurCents: number;
  imageUrl: string | null;
  qty: number;
  // Present only once this line has been synced to the server cart (logged
  // in) — needed to address it for PATCH/DELETE, which key by cart_item id,
  // not productVariantId. Absent for a guest (localStorage-only) line.
  cartItemId?: string;
}

// Raw shape of one row from GET /api/cart's `items` array.
export interface ServerCartItem {
  id: string;
  qty: number;
  productVariantId: string;
  sku: string;
  capacity: number | null;
  capacityUnit: string | null;
  formatType: string | null;
  priceEurCents: number;
  imageUrl: string | null;
  inStock: boolean;
  productId: string;
  productSlug: string;
  productName: string;
}

export type OrderStatus = "collecting" | "paid" | "transit" | "delivered";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  collecting: "Сбор заказа",
  paid: "Оплата подтверждена",
  transit: "Выкуплен, в пути",
  delivered: "Получен",
};

// "pickup"/"post" only ever appear on historical orders — self-pickup and
// Почта России were both retired, checkout now always submits "cdek".
export type Fulfillment = "pickup" | "post" | "cdek";

export interface OrderItem {
  id: string;
  skuSnapshot: string;
  nameSnapshot: string;
  priceEurCentsSnapshot: number;
  capacitySnapshot: string | null;
  qty: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  fulfillment: Fulfillment;
  city: string | null;
  address: string | null;
  comment: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  subtotalEurCents: number;
  fxRateUsed: string;
  // Payment to our fulfillment helpers ("феям-помощницам") — IS part of
  // totalRub below, prepaid by the customer along with the items. Distinct
  // from CDEK courier delivery, which the customer pays separately, straight
  // to the courier on receipt, never through us.
  helperFeeRub: number;
  totalRub: number;
  // Set once the customer clicks "Я оплатил" in the payment modal — their
  // own unverified claim, not proof of payment (see api's schema.ts
  // comment); doesn't itself change `status`.
  customerMarkedPaidAt: string | null;
  // Admin-attached courier tracking link — null until staff set one.
  trackingUrl: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  // The account's single saved delivery address (see api/schema.ts's
  // comment on `users.city`/`users.address`) — null until set on
  // /account/addresses. Prefills CheckoutForm's address fields.
  city: string | null;
  address: string | null;
}
