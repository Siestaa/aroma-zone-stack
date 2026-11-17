"use client";

import { useAppSelector } from "@/lib/redux/hooks";
import { selectCartLines } from "@/lib/redux/cartSlice";
import { useCartActions } from "@/lib/redux/useCartActions";
import type { ProductListItem } from "@/lib/api/types";
import styles from "./ProductQuickAdd.module.css";

// Bottom-right cart overlay on ProductCard — adds the product's cheapest
// variant straight from the catalog/favorites grid, no product-page visit
// needed. Swaps to a qty stepper once that variant is actually in the
// cart, sourced live from Redux (cartSlice mirrors both guest-local and
// server-synced carts into the same shape, see useCartActions.ts) so it
// stays in sync with edits made elsewhere (e.g. the cart page itself).
export function ProductQuickAdd({ product, className }: { product: ProductListItem; className?: string }) {
  const { addLine, setQty } = useCartActions();
  const line = useAppSelector((state) =>
    selectCartLines(state).find((l) => l.productVariantId === product.defaultVariantId),
  );

  if (!product.inStock) return null;

  function stop(e: React.SyntheticEvent) {
    // ProductCard wraps this whole thing in a <Link> — never navigate when
    // interacting with the quick-add control itself.
    e.preventDefault();
    e.stopPropagation();
  }

  if (line) {
    return (
      <div className={`${styles.stepper} ${className ?? ""}`} onClick={stop}>
        <button
          type="button"
          aria-label="Уменьшить количество"
          onClick={(e) => {
            stop(e);
            setQty(line, line.qty - 1);
          }}
        >
          −
        </button>
        <span className={styles.n}>{line.qty}</span>
        <button
          type="button"
          aria-label="Увеличить количество"
          onClick={(e) => {
            stop(e);
            setQty(line, line.qty + 1);
          }}
        >
          +
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.addBtn} ${className ?? ""}`}
      aria-label="Добавить в корзину"
      onClick={(e) => {
        stop(e);
        addLine({
          productVariantId: product.defaultVariantId,
          productSlug: product.slug,
          productName: product.name,
          sku: product.defaultVariantSku,
          capacity: product.defaultVariantCapacity,
          capacityUnit: product.defaultVariantCapacityUnit,
          // formatType is computed via the same cheapest-variant-wins SQL as
          // defaultVariantId (see api/CLAUDE.md), so it's guaranteed to
          // describe the same variant being added here.
          formatType: product.formatType,
          priceEurCents: product.minPriceEurCents,
          imageUrl: product.imageUrl,
          qty: 1,
        });
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
      </svg>
    </button>
  );
}
