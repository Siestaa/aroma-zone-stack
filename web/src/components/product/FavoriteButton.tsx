"use client";

import { useRouter } from "next/navigation";
import { useMeQuery } from "@/lib/redux/authApi";
import { useAddFavoriteMutation, useGetFavoritesQuery, useRemoveFavoriteMutation } from "@/lib/redux/favoritesApi";
import styles from "./FavoriteButton.module.css";

export function FavoriteButton({ productId, className }: { productId: string; className?: string }) {
  const router = useRouter();
  const { data: user } = useMeQuery();
  const { data: favorites } = useGetFavoritesQuery(undefined, { skip: !user });
  const [addFavorite, { isLoading: adding }] = useAddFavoriteMutation();
  const [removeFavorite, { isLoading: removing }] = useRemoveFavoriteMutation();

  const isFavorite = favorites?.some((f) => f.id === productId) ?? false;

  function handleClick(e: React.MouseEvent) {
    // ProductCard wraps this in a <Link> — don't navigate when toggling.
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push("/account");
      return;
    }
    if (isFavorite) removeFavorite(productId);
    else addFavorite(productId);
  }

  return (
    <button
      type="button"
      className={`${styles.btn} ${className ?? ""}`}
      data-active={isFavorite}
      disabled={adding || removing}
      aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
      onClick={handleClick}
    >
      {isFavorite ? "♥" : "♡"}
    </button>
  );
}
