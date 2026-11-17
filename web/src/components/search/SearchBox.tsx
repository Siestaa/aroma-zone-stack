"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { ProductThumb } from "@/components/product/ProductThumb";
import { formatEurCents } from "@/lib/format";
import { useSearchProductsQuery } from "./searchApi";
import styles from "./SearchBox.module.css";

const MIN_QUERY_LENGTH = 2;

export function SearchBox({
  variant = "toolbar",
  placeholder = "Найти товар…",
  defaultValue = "",
  onSubmitQuery,
}: {
  variant?: "hero" | "toolbar";
  placeholder?: string;
  defaultValue?: string;
  onSubmitQuery?: (query: string) => void;
}) {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedValue = useDebouncedValue(value.trim(), 300);
  const shouldSearch = debouncedValue.length >= MIN_QUERY_LENGTH;

  const { data: results, isFetching } = useSearchProductsQuery(debouncedValue, {
    skip: !shouldSearch,
  });

  function submit(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    setOpen(false);
    if (onSubmitQuery) {
      onSubmitQuery(trimmed);
    } else {
      router.push(`/catalog?q=${encodeURIComponent(trimmed)}`);
    }
  }

  function handleFocus() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function handleBlur() {
    // delay so a click on a result registers before the panel unmounts
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  const showPanel = open && shouldSearch;

  return (
    <div className={`${styles.wrap} ${variant === "hero" ? styles.hero : ""}`}>
      <form
        className={styles.form}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Поиск товаров
        </label>
        <input
          id={inputId}
          className={styles.input}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoComplete="off"
        />
        <button type="submit" className={`${styles.submitButton} tap-target`} aria-label="Найти">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </form>

      {showPanel && (
        <div className={styles.panel}>
          {isFetching && <div className={styles.status}>Ищем…</div>}
          {!isFetching && results?.length === 0 && (
            <div className={styles.status}>Ничего не нашлось по «{debouncedValue}»</div>
          )}
          {!isFetching &&
            results?.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className={styles.result}
                transitionTypes={["nav-forward"]}
              >
                <ProductThumb imageUrl={product.imageUrl} alt={product.name} size="sm" surface="raised" />
                <span className={styles.resultText}>
                  <span className={styles.resultName}>{product.name}</span>
                </span>
                <span className={styles.resultPrice}>{formatEurCents(product.minPriceEurCents)}</span>
              </Link>
            ))}
          {!isFetching && results && results.length > 0 && (
            <button type="button" className={styles.seeAll} onClick={() => submit(value)}>
              Показать все результаты по «{debouncedValue}»
            </button>
          )}
        </div>
      )}
    </div>
  );
}
