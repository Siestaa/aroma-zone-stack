import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { settings } from "../db/schema.js";

// Admin-editable content for the static info pages (About/Delivery/Payment
// share this shape; Contacts is structurally different — see
// ContactsPageContent below). Stored in the same settings k/v table as
// everything else in settingsService.ts — split into its own file since
// this is a meaningfully separate, larger concern (4 pages' worth of copy)
// rather than a handful of scalar settings.

export interface InfoPageBlock {
  title: string;
  body: string;
}

export interface InfoPageContent {
  eyebrow: string;
  title: string;
  lede: string;
  // Admin can reorder/edit/add/remove these — see adminPages.ts. Rendered
  // in a single consistent card style per page regardless of position, so
  // reordering never changes how an individual block looks.
  blocks: InfoPageBlock[];
  // About-only trailing disclaimer — no title, always last, smaller/muted
  // style (see web/src/app/about/page.tsx) — kept separate from `blocks`
  // rather than folded in as a title-less block, since its role (a fixed
  // legal footnote) is structurally different from the reorderable list.
  note?: string;
}

export type InfoPageSlug = "about" | "delivery" | "payment";

// Original hand-written copy — unchanged behavior until an admin actually
// edits a field (same convention as settingsService.ts's home hero/config).
const DEFAULT_INFO_PAGES: Record<InfoPageSlug, InfoPageContent> = {
  about: {
    eyebrow: "О сервисе",
    title: "Мы организуем совместную закупку товаров с сайта Aroma-Zone",
    lede: "Полный каталог французского Aroma-Zone с переводом на русский — но не склад: мы выкупаем товар во Франции только после того, как вы оплатили заказ. Это гарантирует свежесть партии и настоящую цену производителя.",
    blocks: [
      {
        title: "Полный каталог Aroma-Zone",
        body: "Ассортимент — как на официальном сайте в Париже, переводим карточки на русский.",
      },
      {
        title: "Выкуп после оплаты",
        body: "Ничего не лежит на складе месяцами — заказ уходит во Францию только под уже оплаченный цикл.",
      },
      {
        title: "Доставка из Франции — бесплатно",
        body: "Вы оплачиваете только пересылку из Омска до вашего города, не международную доставку.",
      },
    ],
    note: "аромазон-тут — независимый сервис совместных закупок, официальным магазином или представительством Aroma-Zone (Франция) не является.",
  },
  delivery: {
    eyebrow: "Доставка",
    title: "Как забрать заказ после выкупа",
    lede: "После закрытия цикла и выкупа во Франции посылка идёт 10–14 дней (зависит от таможни и почты), фотографируется и разбирается по заказам в Омске.",
    blocks: [
      {
        title: "СДЭК",
        body: "Отправляем в ближайший к вам пункт выдачи или курьером. Стоимость доставки не входит в предоплату заказа — оплачивается отдельно, курьеру или в пункте выдачи, при получении.",
      },
      {
        title: "Невостребованные посылки",
        body: "Если посылка не забрана в течение 30 дней и вернулась к нам не по нашей вине — стоимость заказа не возвращается.",
      },
    ],
  },
  payment: {
    eyebrow: "Оплата",
    title: "Оплата картой, сумма — по курсу на день выкупа",
    lede: "После оформления заказа на email приходит подтверждение с суммой по текущему курсу. Перевод — картой на карту, указанную в письме. Заказ подтверждается только после 100% предоплаты.",
    blocks: [
      {
        title: "Почему сумма в рублях не равна курсу ЦБ",
        body: "Мы берём официальный курс ЦБ и добавляем фиксированную наценку — она покрывает растаможку заказа при ввозе в Россию, отдельно от стоимости доставки. Поэтому сумма в письме будет немного выше курса ЦБ — это не ошибка и не наша прибыль сверху цены товара, а часть расходов на то, чтобы посылка вообще доехала. Считаем по курсу на день выкупа заказа во Франции, а не на день оформления: при недоплате нужно доплатить остаток на ту же карту, при переплате — вернём разницу на телефон, указанный при регистрации.",
      },
      {
        title: "Как это выглядит по шагам",
        body: "1. Оформляете заказ → 2. Письмо с суммой и реквизитами → 3. Перевод картой на карту → 4. Вы — участник закупки цикла.",
      },
      {
        title: "Если сумма изменилась",
        body: "Курс на день выкупа отличается от дня заказа — почти всегда. Разницу закрываем доплатой или возвратом на телефон.",
      },
    ],
  },
};

function settingsKeyFor(slug: InfoPageSlug) {
  return `info_page_${slug}`;
}

export async function getInfoPageContent(slug: InfoPageSlug): Promise<InfoPageContent> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, settingsKeyFor(slug)) });
  const saved = row?.value as Partial<InfoPageContent> | undefined;
  const fallback = DEFAULT_INFO_PAGES[slug];
  if (!saved) return fallback;

  return {
    eyebrow: saved.eyebrow?.trim() || fallback.eyebrow,
    title: saved.title?.trim() || fallback.title,
    lede: saved.lede?.trim() || fallback.lede,
    blocks: saved.blocks && saved.blocks.length > 0 ? saved.blocks : fallback.blocks,
    ...(fallback.note !== undefined ? { note: saved.note?.trim() || fallback.note } : {}),
  };
}

export async function setInfoPageContent(slug: InfoPageSlug, content: InfoPageContent): Promise<void> {
  await db
    .insert(settings)
    .values({ key: settingsKeyFor(slug), value: content })
    .onConflictDoUpdate({ target: settings.key, set: { value: content } });
}

// Contacts has no blocks — just admin-editable fields. "Город" was dropped
// entirely per the client (no longer shown at all, not just unedited). The
// VK community-card sentence is split into three editable pieces (text
// before the link / the link's own visible text / its URL) rather than one
// field with a hardcoded link, so admin can point it at a different
// community or reword the link text without a code change.
export interface ContactsPageContent {
  email: string;
  communityText: string;
  communityLinkText: string;
  communityLinkUrl: string;
}

const DEFAULT_CONTACTS: ContactsPageContent = {
  email: "aromazone.tut@gmail.com",
  communityText: "Актуальные остатки, трек-номера и фотоотчёты закупок — в",
  communityLinkText: "группе ВКонтакте",
  communityLinkUrl: "https://vk.com/natural_organic_products",
};

export async function getContactsPageContent(): Promise<ContactsPageContent> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "info_page_contacts") });
  const saved = row?.value as Partial<ContactsPageContent> | undefined;
  return {
    email: saved?.email?.trim() || DEFAULT_CONTACTS.email,
    communityText: saved?.communityText?.trim() || DEFAULT_CONTACTS.communityText,
    communityLinkText: saved?.communityLinkText?.trim() || DEFAULT_CONTACTS.communityLinkText,
    communityLinkUrl: saved?.communityLinkUrl?.trim() || DEFAULT_CONTACTS.communityLinkUrl,
  };
}

export async function setContactsPageContent(content: ContactsPageContent): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "info_page_contacts", value: content })
    .onConflictDoUpdate({ target: settings.key, set: { value: content } });
}

// The second accordion item on every product page ("Как считается цена и
// доставка") — the first accordion item is the product's own real
// description (product.description), not admin content, so only this one
// static note lives here. Single title+body pair, not a `blocks[]` list
// like the info pages above, since there's only ever this one note.
export interface ProductPageNote {
  title: string;
  body: string;
}

const DEFAULT_PRODUCT_PAGE_NOTE: ProductPageNote = {
  title: "Как считается цена и доставка",
  body: "Цена в евро — как на сайте поставщика во Франции. Сумма в рублях пересчитывается по курсу на день выкупа заказа, а не на день оформления. Доставка из Франции бесплатна, вы оплачиваете только пересылку из Омска.",
};

export async function getProductPageNote(): Promise<ProductPageNote> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "product_page_note") });
  const saved = row?.value as Partial<ProductPageNote> | undefined;
  return {
    title: saved?.title?.trim() || DEFAULT_PRODUCT_PAGE_NOTE.title,
    body: saved?.body?.trim() || DEFAULT_PRODUCT_PAGE_NOTE.body,
  };
}

export async function setProductPageNote(note: ProductPageNote): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "product_page_note", value: note })
    .onConflictDoUpdate({ target: settings.key, set: { value: note } });
}
