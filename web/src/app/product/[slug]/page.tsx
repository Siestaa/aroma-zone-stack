import { notFound } from "next/navigation";
import Link from "next/link";
import { ViewTransition } from "react";
import { apiGet } from "@/lib/api/server";
import type { ProductDetail } from "@/lib/api/types";
import { Tag } from "@/components/ui/Tag";
import { ProductThumb } from "@/components/product/ProductThumb";
import { FavoriteButton } from "@/components/product/FavoriteButton";
import { ProductAccordion } from "@/components/ui/ProductAccordion";
import { PageTransition } from "@/components/transitions/PageTransition";
import { ProductActions } from "./ProductActions";
import styles from "./page.module.css";

// Original hand-written copy — used only if /api/pages/product-note itself
// fails (the endpoint already falls back to this same text server-side
// when nothing's configured, so this is a last-resort mirror, not the
// primary source of truth).
const PRODUCT_NOTE_FALLBACK = {
  title: "Как считается цена и доставка",
  body: "Цена в евро — как на сайте поставщика во Франции. Сумма в рублях пересчитывается по курсу на день выкупа заказа, а не на день оформления. Доставка из Франции бесплатна, вы оплачиваете только пересылку из Омска.",
};

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const [product, productNote] = await Promise.all([
    apiGet<ProductDetail>(`/products/${slug}`),
    apiGet<{ title: string; body: string }>("/pages/product-note"),
  ]);
  if (!product) notFound();

  const category = product.categories[0];
  const primaryImage = product.variants[0]?.imageUrl ?? null;
  const note = productNote ?? PRODUCT_NOTE_FALLBACK;

  const accordionItems = [
    {
      value: "description",
      title: "Описание и применение",
      content: product.description,
    },
    {
      value: "shipping",
      title: note.title,
      content: note.body,
    },
  ];

  return (
    <PageTransition>
      <main>
        <div className={styles.crumbs}>
          <Link href="/" transitionTypes={["nav-back"]}>
            Главная
          </Link>{" "}
          /{" "}
          <Link href="/catalog" transitionTypes={["nav-back"]}>
            Каталог
          </Link>
          {category ? ` / ${category.name}` : ""} / {product.name}
        </div>
        <div className={styles.layout}>
          <div className={styles.thumbWrap}>
            <ViewTransition name={`product-thumb-${product.id}`} share="morph" default="none">
              <ProductThumb imageUrl={primaryImage} alt={product.name} size="lg" />
            </ViewTransition>
            <FavoriteButton productId={product.id} className={styles.favOverlay} />
          </div>
          <div>
            {product.bio && <Tag tag="bio" className={styles.tag} />}
            <h1 className={styles.title}>{product.name}</h1>
            {product.nameOriginal !== product.name && <p className={styles.latin}>{product.nameOriginal}</p>}
            {/* Product slugs come straight from Aroma-Zone's own Algolia index
                (syncCatalog.ts's `slug: hit.slug`), which mirrors their site's
                own product-page slug — the path prefix itself
                (/info/fiche-technique/, not /info/fiche/) was confirmed
                against a real product page on aroma-zone.com. */}
            <a
              href={`https://www.aroma-zone.com/info/fiche-technique/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.sourceLink} tap-target`}
            >
              Смотреть этот товар на официальном сайте aroma-zone.com ↗
            </a>

            <ProductActions product={product} />

            <ProductAccordion items={accordionItems} />
          </div>
        </div>
      </main>
    </PageTransition>
  );
}
