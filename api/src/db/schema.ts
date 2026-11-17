import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Matches web/src/lib/mock/types.ts OrderStatus exactly, so
// ORDER_STATUS_LABEL keeps working unchanged once the frontend switches over.
// "paid" sits between collecting/transit — set by staff once they've
// verified the transfer actually arrived (see orders.customerMarkedPaidAt
// below for the customer's own, unverified "I paid" claim, which never
// changes this column by itself).
export const orderStatusEnum = pgEnum("order_status", ["collecting", "paid", "transit", "delivered"]);
// "pickup"/"post" only appear on historical orders (self-pickup and Почта
// России were both retired — every order is now shipped via CDEK, paid by
// the customer directly to the courier on receipt, not through us). Kept
// in the enum rather than migrated away so old orders keep their true,
// as-placed fulfillment method instead of being silently relabeled.
export const fulfillmentEnum = pgEnum("fulfillment", ["pickup", "post", "cdek"]);

// Sourced directly from Aroma-Zone's own categoryKeys tags (verified against
// the live site's own facet counts, not invented) — one row per real tag
// worth surfacing. `nameFr` is the exact original tag string, matched
// against each product's `categories_raw` via JSONB containment (a product
// naturally belongs to many categories, so this is a many-to-many computed
// on the fly rather than a junction table — categories_raw already holds
// everything needed). `isProductType` distinguishes genuine "what kind of
// product is this" tags (Huiles essentielles, Hydrolats, ...) from
// AZ's marketing/audience/occasion/facet tags (Idées cadeaux, Exclusivité
// Web, Par type de peau, ...) that share the same categoryKeys field —
// only product-type categories drive the catalog filter sidebar and the
// homepage's top-5.
export const categories = pgTable("categories", {
  slug: text("slug").primaryKey(),
  nameFr: text("name_fr").notNull(),
  nameRu: text("name_ru").notNull(),
  isProductType: boolean("is_product_type").notNull().default(false),
}, (table) => [
  uniqueIndex("categories_name_fr_idx").on(table.nameFr),
]);

// One row per Algolia objectID (a product "family" — e.g. one essential oil,
// independent of which bottle sizes it comes in).
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  objectId: text("object_id").notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  // Russian translations of name/description above — null until translated
  // (done by hand, in batches, not a live API call from the sync job; see
  // api/CLAUDE.md). syncCatalog.ts nulls these out again whenever the
  // French source text actually changes, so a stale translation never
  // lingers silently — the frontend falls back to the French original
  // whenever the *Ru column is null (see services/translationService.ts).
  nameRu: text("name_ru"),
  descriptionRu: text("description_ru"),
  familleTechnique: text("famille_technique").notNull().default(""),
  // Raw ~50-entry Algolia categoryKeys list for this product — the source of
  // truth for category membership (see `categories` table above; a product
  // belongs to every category whose nameFr appears in this array, computed
  // via JSONB containment rather than a single FK column).
  categoriesRaw: jsonb("categories_raw").$type<string[]>().notNull().default([]),
  bestSeller: boolean("best_seller").notNull().default(false),
  // Derived from Algolia's attributes.culture (values like "BIO cosmétique",
  // "Cosmos organic" vs "Conventionnelle"/"Sauvage") — a real certification
  // signal from the source data, not a guess.
  bio: boolean("bio").notNull().default(false),
  ratingAvg: real("rating_avg"),
  ratingCount: integer("rating_count"),
  isAnyVariantInStock: boolean("is_any_variant_in_stock").notNull().default(true),
  // One main image per product (the cheapest variant's, downloaded and
  // hosted by us — see syncCatalog.ts) rather than one per variant: the raw
  // AZ/commercetools CDN is unreachable for some Russian ISPs without a
  // VPN, so hotlinking it broke images for real visitors. `imageUrl` is our
  // own served path (`/api/images/<objectId>.<ext>`, null until the first
  // successful download); `sourceImageUrl` is the upstream URL last used to
  // populate it, kept purely so re-syncs can skip re-downloading an
  // unchanged image.
  imageUrl: text("image_url"),
  sourceImageUrl: text("source_image_url"),
  // Admin-only visibility toggle (e.g. discontinued/out-of-stock-for-good
  // item) — never touched by syncCatalog.ts's upsert, so a hidden product
  // stays hidden across daily re-syncs until an admin un-hides it.
  hidden: boolean("hidden").notNull().default(false),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("products_object_id_idx").on(table.objectId),
  uniqueIndex("products_slug_idx").on(table.slug),
  index("products_categories_raw_gin_idx").using("gin", table.categoriesRaw),
]);

// One row per SKU (a specific bottle size / variant of a product).
export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  capacity: real("capacity"),
  capacityUnit: text("capacity_unit"),
  // AZ's own variant-format label ("flacon-verre", "eco-recharge", ...) —
  // only available from an individual product page's payload, not the bulk
  // Algolia index this catalog is otherwise synced from (see api/CLAUDE.md).
  // Null for the vast majority of variants; only manually backfilled for the
  // ~30 products where two variants share the same capacity and this is the
  // only way to tell them apart — not worth a full-catalog crawl for.
  formatType: text("format_type"),
  priceEurCents: integer("price_eur_cents").notNull(),
  inStock: boolean("in_stock").notNull().default(true),
}, (table) => [
  uniqueIndex("product_variants_sku_idx").on(table.sku),
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  phone: text("phone"),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  // One saved delivery address per account (not a separate table — a group-
  // buy customer typically has exactly one real shipping address, and this
  // is what prefills the checkout form's "Почта России" city/address fields
  // — see CheckoutForm.tsx). Both null until the user fills in /account/addresses.
  city: text("city"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
]);

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// Logged-in users only — guests keep their cart in localStorage and never
// touch this table (see plan: hybrid guest/account checkout).
export const cartItems = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productVariantId: uuid("product_variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  qty: integer("qty").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("cart_items_user_variant_idx").on(table.userId, table.productVariantId),
]);

export const favorites = pgTable("favorites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("favorites_user_product_idx").on(table.userId, table.productId),
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  // null = guest order (not queryable by the buyer afterwards, per plan).
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  status: orderStatusEnum("status").notNull().default("collecting"),
  fulfillment: fulfillmentEnum("fulfillment").notNull(),
  city: text("city"),
  address: text("address"),
  comment: text("comment"),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  subtotalEurCents: integer("subtotal_eur_cents").notNull(),
  fxRateUsed: numeric("fx_rate_used", { precision: 10, scale: 4 }).notNull(),
  // Per-order snapshot of a flat service fee — what we pay our fulfillment
  // helpers ("феям-помощницам") for handling this order — charged to and
  // prepaid by the customer, IS part of totalRub below. Distinct from
  // actual CDEK courier delivery, which the customer pays separately,
  // directly to the courier on receipt, never through us (see
  // settingsService.ts's getHelperFeeRub). DB column intentionally still
  // named "shipping_rub" — this used to literally be a shipping charge
  // before the delivery-mechanics change; renaming the column needs a real
  // migration for zero functional benefit, so only the JS-side name did.
  helperFeeRub: integer("shipping_rub").notNull().default(0),
  totalRub: integer("total_rub").notNull(),
  // Customer's own unverified "I sent the money" claim from the "Оплатить"
  // modal on /account/orders — purely informational, tells staff to go
  // check for the transfer. Does NOT flip `status` to "paid" by itself;
  // that's a separate, deliberate staff action once they've actually
  // confirmed the money arrived (see adminOrderService.ts).
  customerMarkedPaidAt: timestamp("customer_marked_paid_at", { withTimezone: true }),
  // Admin-set courier tracking link (CDEK's own tracking page for this
  // parcel) — free text, not validated as a URL server-side, since a
  // tracking "link" from a courier isn't always a strict URL and staff
  // paste whatever CDEK gives them. Null until staff attach one.
  trackingUrl: text("tracking_url"),
  // Set the first time staff open this order's detail page in the admin
  // panel (adminOrderService.ts's markOrderViewedByAdmin) — drives the
  // "Новый" badge on the admin orders list. Null means nobody has drilled
  // into it yet; never cleared back to null once set.
  viewedByAdminAt: timestamp("viewed_by_admin_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  // Kept even if the variant is later removed from the catalog — order
  // history must show what was actually bought, not today's catalog state.
  productVariantId: uuid("product_variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  skuSnapshot: text("sku_snapshot").notNull(),
  nameSnapshot: text("name_snapshot").notNull(),
  priceEurCentsSnapshot: integer("price_eur_cents_snapshot").notNull(),
  capacitySnapshot: text("capacity_snapshot"),
  qty: integer("qty").notNull(),
});

// Small key/value store — e.g. { key: "fx_rate_eur_rub", value: { rate: 109.2, updatedAt: "..." } }
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

// Staff accounts for the separate admin panel (its own repo) — deliberately
// its own table, not a role flag on `users`: admin login has a different
// trust level (2FA-gated) and must never be reachable via the storefront's
// register/login endpoints or session cookie.
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  // Null until the admin completes TOTP setup on first login; totpEnabled
  // flips true only after they've confirmed one valid code, so a
  // half-finished setup can't lock them out or leave 2FA silently off.
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("admin_users_email_idx").on(table.email),
]);

export const adminSessions = pgTable("admin_sessions", {
  token: text("token").primaryKey(),
  adminUserId: uuid("admin_user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  productVariant: one(productVariants, { fields: [orderItems.productVariantId], references: [productVariants.id] }),
}));
