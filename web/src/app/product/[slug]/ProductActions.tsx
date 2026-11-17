"use client";

import { useEffect, useState } from "react";
import { useCartActions } from "@/lib/redux/useCartActions";
import { formatApproxRub, formatCapacity, formatEurCents, formatTypeLabel } from "@/lib/format";
import type { ProductDetail } from "@/lib/api/types";
import styles from "./ProductActions.module.css";
import pageStyles from "./page.module.css";

export function ProductActions({ product }: { product: ProductDetail }) {
  const { addLine } = useCartActions();
  const inStockVariants = product.variants.filter((v) => v.inStock);
  const [variantId, setVariantId] = useState(inStockVariants[0]?.id ?? product.variants[0]?.id);
  const [added, setAdded] = useState(false);

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1400);
    return () => clearTimeout(t);
  }, [added]);

  if (!variant) return null;

  return (
    <>
      <div className={pageStyles.priceRow}>
        <span className="price">{formatEurCents(variant.priceEurCents)}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.6 }}>
          за {formatCapacity(variant.capacity, variant.capacityUnit)}
        </span>
      </div>
      <div className={pageStyles.approx}>
        {formatApproxRub(variant.approxRub)} — курс ЦБ с наценкой за растаможку, пересчитывается на день
        выкупа
      </div>

      {product.variants.length > 1 && (
        <div className={styles.volumes}>
          {product.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              className={styles.vol}
              data-active={v.id === variantId}
              disabled={!v.inStock}
              onClick={() => setVariantId(v.id)}
            >
              <span>{formatCapacity(v.capacity, v.capacityUnit)}</span>
              {formatTypeLabel(v.formatType) && (
                <span className={styles.volFormat}>{formatTypeLabel(v.formatType)}</span>
              )}
              <span className={styles.volPrice}>{formatEurCents(v.priceEurCents)}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className={styles.addBtn}
        data-added={added}
        disabled={!variant.inStock}
        onClick={() => {
          addLine({
            productVariantId: variant.id,
            productSlug: product.slug,
            productName: product.name,
            sku: variant.sku,
            capacity: variant.capacity,
            capacityUnit: variant.capacityUnit,
            formatType: variant.formatType,
            priceEurCents: variant.priceEurCents,
            imageUrl: variant.imageUrl,
            qty: 1,
          });
          setAdded(true);
        }}
      >
        {!variant.inStock ? "Нет в наличии" : added ? "Добавлено ✓" : "Добавить в заказ"}
      </button>
      <div className={pageStyles.disclaimer}>
        Заказ подтверждается 100% предоплатой картой на карту. Сумма и оплата — на странице
        «Оплата».
      </div>
    </>
  );
}
