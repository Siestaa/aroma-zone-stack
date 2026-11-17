import Link from "next/link";
import { apiGet } from "@/lib/api/server";
import type { Category, ProductListItem } from "@/lib/api/types";
import { ProductGrid } from "@/components/product/ProductGrid";
import { PageTransition } from "@/components/transitions/PageTransition";
import { SearchBox } from "@/components/search/SearchBox";
import styles from "./page.module.css";

export default async function Home() {
  // Admin-picked and ordered when configured (admin panel's "Главная" page,
  // api/src/routes/adminHome.ts) — falls back server-side to the automatic
  // top-5-by-count / top-4-popular logic when nothing's been pinned, so this
  // stays a single call either way (see api/src/routes/products.ts's GET /home).
  // hero is admin-editable text (settingsService.ts's getHomeHeroText) —
  // undefined only if /api/home itself failed, hence the fallback literals
  // below (the endpoint's own default already covers "never configured").
  const home = await apiGet<{
    categories: Category[];
    products: ProductListItem[];
    hero: { eyebrow: string; title: string; lede: string };
  }>("/home");
  const topCategories = home?.categories ?? [];
  const featured = home?.products ?? [];
  const hero = home?.hero ?? {
    eyebrow: "Совместная закупка · без переплаты за доставку из Франции",
    title: "Весь каталог Aroma‑Zone на русском — мы выкупаем и присылаем",
    lede: "Заказываете как в обычном магазине, мы выкупаем товар во Франции после оплаты и отправляем из Омска. Доставка из Франции в Россию — за наш счёт.",
  };

  return (
    // See catalog/page.tsx's comment on the same pattern: PageTransition
    // wraps only the product grid, not the whole <main> — the hero/
    // categories sections stay outside any <ViewTransition> so the shared
    // product-thumb-* morph doesn't end up nested many layers inside one
    // huge named boundary.
    <main>
      <section className={styles.hero}>
        <div>
          <span className={styles.heroEyebrow}>{hero.eyebrow}</span>
          <h1 className={styles.heroTitle}>{hero.title}</h1>
          <p className={styles.heroText}>{hero.lede}</p>
          <div className={styles.heroSearch}>
            <SearchBox variant="hero" placeholder="Найти товар по названию…" />
          </div>
          <Link href="/catalog" className={styles.cta} transitionTypes={["nav-forward"]}>
            Смотреть каталог
          </Link>
        </div>
        <div className={styles.heroLogoWrap} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-logo.png" alt="" className={styles.heroLogo} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Категории</h2>
        <div className={styles.catGrid}>
          {topCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/catalog?category=${cat.slug}`}
              className={styles.catTile}
              transitionTypes={["nav-forward"]}
            >
              <span className={styles.catCount}>{cat.count} товаров</span>
              {cat.name}
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Лидеры продаж</h2>
        <PageTransition>
          <ProductGrid products={featured} />
        </PageTransition>
        <p className={styles.footnote}>
          * цена ориентировочная — курс ЦБ с наценкой за растаможку, точная сумма определяется на день
          выкупа во Франции — подробнее на странице «Оплата»
        </p>
      </section>
    </main>
  );
}
