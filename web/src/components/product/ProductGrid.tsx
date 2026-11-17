import { ViewTransition } from "react";
import type { ProductListItem } from "@/lib/api/types";
import { ProductCard } from "./ProductCard";
import styles from "./ProductGrid.module.css";

export function ProductGrid({ products }: { products: ProductListItem[] }) {
  return (
    <div className={styles.grid}>
      {products.map((product) => (
        // enter/exit: "none" (paired with globals.css's ::view-transition-*(.none)
        // rule) only mutes this wrapper's OWN default fade for a cross-page nav,
        // where the whole card mounts/unmounts fresh — that generic fade used to
        // run at the same time as, and fight with, the deeper named morph on a
        // shared product-thumb-* image inside it (see ProductCard.tsx), reading
        // as the arriving photo flickering right as its card landed. `update` is
        // deliberately left unset so the same-page list-reorder animation (sort/
        // filter changes on /catalog, where a product keeps its key and just
        // moves) keeps its default reposition animation.
        <ViewTransition key={product.id} enter="none" exit="none">
          <ProductCard product={product} />
        </ViewTransition>
      ))}
    </div>
  );
}
