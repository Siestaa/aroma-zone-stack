export type OrderStatus = "collecting" | "paid" | "transit" | "delivered" | "cancelled";
// "pickup"/"post" only appear on historical orders — self-pickup and Почта
// России were both retired, every new order is fulfilled via "cdek".
export type Fulfillment = "pickup" | "post" | "cdek";

export interface OrderItem {
  id: string;
  orderId: string;
  productVariantId: string | null;
  skuSnapshot: string;
  nameSnapshot: string;
  priceEurCentsSnapshot: number;
  capacitySnapshot: string | null;
  qty: number;
  // Live-joined via productVariantId, not a snapshot — only present on the
  // single-order GET (getOrderById), absent on the orders-list response.
  // Null when the variant was later removed from the catalog (old order,
  // FK set null) — photo/original-name/source-link just aren't shown then.
  product?: { slug: string; name: string; imageUrl: string | null } | null;
  // Same live-join caveat as `product` above. Disambiguates two variants
  // that share a capacity but are physically different (glass bottle vs
  // eco-refill, differently priced) — see lib/format.ts's formatTypeLabel.
  formatType?: string | null;
}

export interface Order {
  id: string;
  userId: string | null;
  status: OrderStatus;
  cancellationReason: string | null;
  cancelledAt: string | null;
  fulfillment: Fulfillment;
  city: string | null;
  address: string | null;
  comment: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  subtotalEurCents: number;
  fxRateUsed: string;
  // Internal per-order cost (payment to fulfillment helpers), NOT part of
  // totalRub below — delivery itself is paid by the customer directly to
  // the CDEK courier on receipt, not through us.
  helperFeeRub: number;
  totalRub: number;
  // Customer's own unverified "I paid" claim from their orders page —
  // informational only, doesn't imply `status` is "paid" yet (see
  // api/src/db/schema.ts's comment).
  customerMarkedPaidAt: string | null;
  // Admin-attached courier tracking link — null until staff set one.
  trackingUrl: string | null;
  // Set the first time staff open this order's detail page — drives the
  // orders list's "Новый" badge. Never cleared back to null once set.
  viewedByAdminAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface OrdersPage {
  rows: Order[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  nameRu: string | null;
  description: string;
  descriptionRu: string | null;
  imageUrl: string | null;
  hidden: boolean;
  lastSyncedAt: string;
}

export interface ProductsPage {
  rows: AdminProduct[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface SyncStatus {
  running: boolean;
  lastSyncedAt: string | null;
  nextScheduledAt: string;
}

export interface AdminMe {
  id: string;
  email: string;
  totpEnabled: boolean;
}

export interface AdminCategory {
  slug: string;
  name: string;
  count: number;
}

export interface HomeConfigProduct {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
}

export interface HomeHeroText {
  eyebrow: string;
  title: string;
  lede: string;
}

export type InfoPageSlug = "about" | "delivery" | "payment";

export interface InfoPageBlock {
  title: string;
  body: string;
}

export interface InfoPageContent {
  eyebrow: string;
  title: string;
  lede: string;
  blocks: InfoPageBlock[];
  // About-only trailing disclaimer — absent on delivery/payment.
  note?: string;
}

export interface ContactsPageContent {
  email: string;
  communityText: string;
  communityLinkText: string;
  communityLinkUrl: string;
}

export interface ProductPageNoteContent {
  title: string;
  body: string;
}

export interface HomeConfig {
  categorySlugs: string[];
  products: HomeConfigProduct[];
  hero: HomeHeroText;
  footerCategorySlugs: string[];
}

export interface CatalogFiltersConfig {
  categorySlugs: string[];
}
