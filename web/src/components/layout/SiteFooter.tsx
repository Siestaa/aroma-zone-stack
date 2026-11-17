import Link from "next/link";
import { apiGet } from "@/lib/api/server";
import type { Category } from "@/lib/api/types";
import styles from "./SiteFooter.module.css";

// Original hand-picked categories — used only if /api/footer-categories
// itself fails (the endpoint already falls back to these same slugs when
// nothing's configured, so this is a last-resort mirror of that, not the
// primary source of truth).
const FALLBACK_CATEGORIES: Pick<Category, "slug" | "name">[] = [
  { slug: "efirnye-masla", name: "Эфирные масла" },
  { slug: "gidrolaty", name: "Гидролаты" },
  { slug: "pustye-kosmeticheskie-flakony", name: "Флаконы и упаковка" },
];

export async function SiteFooter() {
  const data = await apiGet<{ categories: Category[] }>("/footer-categories");
  const catalogCategories = data?.categories?.length ? data.categories : FALLBACK_CATEGORIES;

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div>
          <h5>Каталог</h5>
          {catalogCategories.map((cat) => (
            <Link key={cat.slug} href={`/catalog?category=${cat.slug}`} transitionTypes={["nav-back"]}>
              {cat.name}
            </Link>
          ))}
        </div>
        <div>
          <h5>Покупателям</h5>
          <Link href="/delivery" transitionTypes={["nav-back"]}>
            Доставка
          </Link>
          <Link href="/payment" transitionTypes={["nav-back"]}>
            Оплата
          </Link>
          <Link href="/contacts" transitionTypes={["nav-back"]}>
            Контакты
          </Link>
        </div>
        <div>
          <h5>О сервисе</h5>
          <Link href="/about" transitionTypes={["nav-back"]}>
            О нас
          </Link>
        </div>
        <div>
          <h5>Сообщество</h5>
          <a href="https://vk.com/natural_organic_products" target="_blank" rel="noopener noreferrer">
            Группа ВКонтакте
          </a>
        </div>
        <div className={styles.fine}>
          аромазон-тут — сервис совместных закупок, независим от Aroma-Zone (Франция). Ассортимент и
          фото — с официального сайта поставщика.
        </div>
      </div>
    </footer>
  );
}
