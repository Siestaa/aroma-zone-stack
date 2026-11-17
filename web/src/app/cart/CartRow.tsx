"use client";

import { useState } from "react";
import Link from "next/link";
import { useCartActions } from "@/lib/redux/useCartActions";
import { ProductThumb } from "@/components/product/ProductThumb";
import { Price } from "@/components/ui/Price";
import { formatCapacity, formatTypeLabel } from "@/lib/format";
import type { CartLine } from "@/lib/api/types";
import styles from "./page.module.css";

export function CartRow({ line, approxRubPerEur }: { line: CartLine; approxRubPerEur: number }) {
  const { setQty, removeLine } = useCartActions();
  const lineTotalCents = line.priceEurCents * line.qty;

  // Typed quantity kept as its own string state — needed while the field
  // is mid-edit (an empty string, or "5" on the way to becoming "50", isn't
  // a valid qty to dispatch yet). Reset to the authoritative line.qty
  // whenever this input isn't the thing driving it — adjusted during
  // render (React's documented pattern for "derive state from a prop that
  // just changed"), not a useEffect, which this project's lint config
  // flags for exactly this shape — so the +/- buttons and server sync
  // still overwrite whatever's showing here once they change line.qty.
  const [qtyInput, setQtyInput] = useState(String(line.qty));
  const [lastSyncedQty, setLastSyncedQty] = useState(line.qty);
  if (line.qty !== lastSyncedQty) {
    setLastSyncedQty(line.qty);
    setQtyInput(String(line.qty));
  }

  function commitQtyInput() {
    const parsed = Math.floor(Number(qtyInput));
    if (!Number.isFinite(parsed) || parsed === line.qty) {
      setQtyInput(String(line.qty));
      return;
    }
    if (parsed <= 0) {
      removeLine(line);
    } else {
      setQty(line, parsed);
    }
  }

  return (
    <div className={styles.row}>
      {/* display: contents (see .thumbLink) — the Link itself takes no grid
          cell, so .thumbCell/.info keep occupying the same two grid columns
          (desktop) / grid-areas (mobile) they did as direct row children. */}
      <Link href={`/product/${line.productSlug}`} className={styles.thumbLink} transitionTypes={["nav-forward"]}>
        <ProductThumb imageUrl={line.imageUrl} alt={line.productName} size="sm" surface="raised" className={styles.thumbCell} />
        <div className={styles.info}>
          <div className={styles.name}>{line.productName}</div>
          <div className={styles.sub}>
            {formatCapacity(line.capacity, line.capacityUnit)}
            {/* Same capacity can be two physically different, differently
                priced SKUs (glass bottle vs eco-refill) — without this,
                ordering both looks like two identical lines with no
                explanation for the price difference. */}
            {formatTypeLabel(line.formatType) && (
              <span className={styles.formatBadge}>{formatTypeLabel(line.formatType)}</span>
            )}
          </div>
        </div>
      </Link>
      <div className={styles.stepper}>
        <button type="button" aria-label="Уменьшить количество" onClick={() => setQty(line, line.qty - 1)}>
          −
        </button>
        <input
          className={styles.n}
          type="text"
          inputMode="numeric"
          aria-label="Количество"
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commitQtyInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <button type="button" aria-label="Увеличить количество" onClick={() => setQty(line, line.qty + 1)}>
          +
        </button>
      </div>
      <div className={styles.priceCell}>
        <Price eurCents={lineTotalCents} approxRub={Math.round((lineTotalCents / 100) * approxRubPerEur)} />
      </div>
      <button type="button" className={styles.remove} onClick={() => removeLine(line)}>
        Удалить
      </button>
    </div>
  );
}
