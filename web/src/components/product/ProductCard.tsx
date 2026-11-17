import { ViewTransition } from "react";
import Link from "next/link";
import type { ProductListItem } from "@/lib/api/types";
import { Tag } from "@/components/ui/Tag";
import { Price } from "@/components/ui/Price";
import { formatTypeLabel } from "@/lib/format";
import { ProductThumb } from "./ProductThumb";
import { FavoriteButton } from "./FavoriteButton";
import { ProductQuickAdd } from "./ProductQuickAdd";
import styles from "./ProductCard.module.css";

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <Link href={`/product/${product.slug}`} className={styles.card} transitionTypes={["nav-forward"]}>
      <div className={styles.thumbWrap}>
        <ViewTransition name={`product-thumb-${product.id}`} share="morph" default="none">
          <ProductThumb imageUrl={product.imageUrl} alt={product.name} surface="raised" />
        </ViewTransition>
        {product.bio && <Tag tag="bio" className={styles.tagOverlay} />}
      </div>
      <h4 className={styles.name}>{product.name}</h4>
      {product.nameOriginal !== product.name && <p className={styles.latin}>{product.nameOriginal}</p>}
      {product.formatType !== "eco-recharge" && formatTypeLabel(product.formatType) && (
        <span className={styles.formatTag}>{formatTypeLabel(product.formatType)}</span>
      )}
      <div className={styles.row}>
        <Price eurCents={product.minPriceEurCents} approxRub={product.approxRub} />
        {!product.inStock && <Tag tag="outOfStock" />}
      </div>
      <FavoriteButton productId={product.id} className={styles.favOverlay} />
      <ProductQuickAdd product={product} className={styles.cartOverlay} />
    </Link>
  );
}
