import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { settings } from "../db/schema.js";

export class SettingsError extends Error {}

// The raw Bank of Russia daily rate, exactly as syncCatalog.ts's
// upsertFxRate wrote it (jobs/fxRate.ts) — no markup applied. Only used
// for the admin settings display (showing CBR/markup/effective as three
// separate numbers) and by getCurrentFxRate below; nowhere else should
// read this directly, since a storefront price computed from the bare
// CBR rate would undercharge by the markup.
export async function getRawCbrRate(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "fx_rate_eur_rub") });
  const rate = (row?.value as { rate?: number } | undefined)?.rate;
  if (!rate) throw new SettingsError("Курс валют недоступен, попробуйте позже");
  return rate;
}

// Markup on top of the raw CBR rate (customs clearance + margin — see the
// storefront copy next to "≈ X ₽" for the customer-facing explanation).
// Admin-configurable (routes/adminSettings.ts); 25₽ is the default agreed
// with the client, applied until an admin sets a different value.
const DEFAULT_FX_MARKUP_RUB = 25;

export async function getFxMarkupRub(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "fx_markup_rub") });
  return (row?.value as { rub?: number } | undefined)?.rub ?? DEFAULT_FX_MARKUP_RUB;
}

export async function setFxMarkupRub(rub: number): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "fx_markup_rub", value: { rub } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { rub } } });
}

// The rate every customer-facing RUB conversion actually uses (product
// prices, cart/checkout totals, order snapshots) — raw CBR rate + markup.
// Deliberately the only fx-rate accessor the storefront services import;
// see getRawCbrRate's comment for why they mustn't reach past this one.
export async function getCurrentFxRate(): Promise<number> {
  const [raw, markup] = await Promise.all([getRawCbrRate(), getFxMarkupRub()]);
  return raw + markup;
}

// Admin-picked category slugs / product ids for the homepage — empty means
// "not configured yet", the read paths that consume these (productService.ts,
// routes/products.ts's GET /home) fall back to the automatic top-N logic in
// that case, so this feature is a no-op until an admin actually sets it.
export async function getHomeCategorySlugs(): Promise<string[]> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "home_categories") });
  return (row?.value as { slugs?: string[] } | undefined)?.slugs ?? [];
}

export async function setHomeCategorySlugs(slugs: string[]): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "home_categories", value: { slugs } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { slugs } } });
}

// Admin-picked, ordered category links in the site footer's "Каталог"
// column (admin panel's "Главная" page) — unlike getHomeCategorySlugs,
// empty here does NOT mean "show nothing"; it falls back to these exact
// original hand-picked slugs (the footer's original hardcoded content, see
// web/src/components/layout/SiteFooter.tsx), same "unchanged behavior
// until an admin actually edits" convention as DEFAULT_HOME_HERO.
const DEFAULT_FOOTER_CATEGORY_SLUGS = ["efirnye-masla", "gidrolaty", "pustye-kosmeticheskie-flakony"];

export async function getFooterCategorySlugs(): Promise<string[]> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "footer_categories") });
  const slugs = (row?.value as { slugs?: string[] } | undefined)?.slugs;
  return slugs && slugs.length > 0 ? slugs : DEFAULT_FOOTER_CATEGORY_SLUGS;
}

export async function setFooterCategorySlugs(slugs: string[]): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "footer_categories", value: { slugs } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { slugs } } });
}

// Admin-picked, ordered subset of product-type categories shown in the
// catalog filter sidebar (admin panel's "Фильтры каталога" page) — same
// "empty means not configured yet" convention as getHomeCategorySlugs: the
// read path (routes/products.ts's GET /categories) falls back to every
// product-type category (listCategoriesWithCounts, unfiltered) until an
// admin actually curates this list.
export async function getCatalogFilterCategorySlugs(): Promise<string[]> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "catalog_filter_categories") });
  return (row?.value as { slugs?: string[] } | undefined)?.slugs ?? [];
}

export async function setCatalogFilterCategorySlugs(slugs: string[]): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "catalog_filter_categories", value: { slugs } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { slugs } } });
}

export async function getHomeProductIds(): Promise<string[]> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "home_products") });
  return (row?.value as { ids?: string[] } | undefined)?.ids ?? [];
}

export async function setHomeProductIds(ids: string[]): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "home_products", value: { ids } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { ids } } });
}

// Homepage hero text (eyebrow / title / lede) — admin-editable via the
// "Главная" panel alongside the category/product picks above. Defaults
// below are the original hand-written copy, so behavior is unchanged until
// an admin actually edits a field (same "empty means not configured yet"
// convention as getHomeCategorySlugs/getHomeProductIds, just per-field
// instead of empty-array — a field is only overridden once it has a
// non-empty saved value).
export interface HomeHeroText {
  eyebrow: string;
  title: string;
  lede: string;
}

const DEFAULT_HOME_HERO: HomeHeroText = {
  eyebrow: "Совместная закупка · без переплаты за доставку из Франции",
  // U+2011 (non-breaking hyphen) in "Aroma‑Zone" — a plain hyphen is a
  // valid line-break point, so at some widths the heading was splitting
  // "Aroma-" from "Zone" across lines (see web/src/app/page.tsx's comment).
  title: "Весь каталог Aroma‑Zone на русском — мы выкупаем и присылаем",
  lede: "Заказываете как в обычном магазине, мы выкупаем товар во Франции после оплаты и отправляем из Омска. Доставка из Франции в Россию — за наш счёт.",
};

export async function getHomeHeroText(): Promise<HomeHeroText> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "home_hero") });
  const saved = (row?.value as Partial<HomeHeroText> | undefined) ?? {};
  return {
    eyebrow: saved.eyebrow?.trim() || DEFAULT_HOME_HERO.eyebrow,
    title: saved.title?.trim() || DEFAULT_HOME_HERO.title,
    lede: saved.lede?.trim() || DEFAULT_HOME_HERO.lede,
  };
}

export async function setHomeHeroText(hero: HomeHeroText): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "home_hero", value: hero })
    .onConflictDoUpdate({ target: settings.key, set: { value: hero } });
}

// Flat per-order service fee — what we pay our fulfillment helpers
// ("феям-помощницам") — charged to and prepaid by the customer along with
// the items (orderService.ts's createOrder adds this into totalRub).
// Distinct from actual CDEK courier delivery, which the customer pays
// separately, straight to the courier on receipt, never through us. Used to
// be labeled a plain shipping charge before the delivery-mechanics change;
// settings key kept as "shipping_rub" on purpose (see schema.ts's
// helperFeeRub comment for the same reasoning).
const DEFAULT_HELPER_FEE_RUB = 350;

export async function getHelperFeeRub(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "shipping_rub") });
  return (row?.value as { rub?: number } | undefined)?.rub ?? DEFAULT_HELPER_FEE_RUB;
}

export async function setHelperFeeRub(rub: number): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "shipping_rub", value: { rub } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { rub } } });
}

// Free-text payment requisites (card number, recipient, bank) shown in the
// "Оплатить" modal on /account/orders — deliberately just a blob of text an
// admin writes/edits, not structured fields, since the real card used can
// change and staff know best how to phrase it. Empty by default (no card
// number invented here) — until an admin fills it in, the modal falls back
// to the same real, already-established fact the checkout page states:
// requisites are sent by email after the order is placed.
export async function getPaymentRequisitesText(): Promise<string> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "payment_requisites") });
  return (row?.value as { text?: string } | undefined)?.text ?? "";
}

export async function setPaymentRequisitesText(text: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "payment_requisites", value: { text } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { text } } });
}

// Checkout's "покупка на условиях" consent checkbox — admin-editable text +
// an inline link (same text/linkText/linkUrl shape as ContactsPageContent's
// community link, infoPagesService.ts), shown next to the required checkbox
// in web/'s CheckoutForm.tsx. Defaults are the copy agreed with the client
// (a VK topic with the actual purchase terms) so behavior is unchanged
// until an admin edits it — same convention as DEFAULT_HOME_HERO.
export interface CheckoutTermsContent {
  text: string;
  linkText: string;
  linkUrl: string;
}

const DEFAULT_CHECKOUT_TERMS: CheckoutTermsContent = {
  text: "Я ознакомлен с",
  linkText: "условиями покупки",
  linkUrl: "https://vk.ru/topic-106767595_32881163",
};

export async function getCheckoutTermsContent(): Promise<CheckoutTermsContent> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "checkout_terms") });
  const saved = (row?.value as Partial<CheckoutTermsContent> | undefined) ?? {};
  return {
    text: saved.text?.trim() || DEFAULT_CHECKOUT_TERMS.text,
    linkText: saved.linkText?.trim() || DEFAULT_CHECKOUT_TERMS.linkText,
    linkUrl: saved.linkUrl?.trim() || DEFAULT_CHECKOUT_TERMS.linkUrl,
  };
}

export async function setCheckoutTermsContent(content: CheckoutTermsContent): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "checkout_terms", value: content })
    .onConflictDoUpdate({ target: settings.key, set: { value: content } });
}
