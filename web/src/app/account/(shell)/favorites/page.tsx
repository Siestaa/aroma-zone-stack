import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api/server";
import { ProductGrid } from "@/components/product/ProductGrid";
import { PageTransition } from "@/components/transitions/PageTransition";
import type { ProductListItem } from "@/lib/api/types";
import styles from "./page.module.css";

export default async function FavoritesPage() {
  const res = await apiFetch("/favorites");
  if (res.status === 401) redirect("/account");
  if (!res.ok) throw new Error(`Failed to load favorites: ${res.status}`);
  const { favorites } = (await res.json()) as { favorites: ProductListItem[] };

  return (
    <PageTransition>
      {favorites.length === 0 ? (
        <p className={styles.empty}>Пока пусто — добавляйте товары в избранное значком ♡ на карточке товара.</p>
      ) : (
        <ProductGrid products={favorites} />
      )}
    </PageTransition>
  );
}
