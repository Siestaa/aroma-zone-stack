"use client";

import { startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "radix-ui";
import styles from "./SortSelect.module.css";

const OPTIONS = [
  { value: "popular", label: "По популярности" },
  { value: "price-asc", label: "Сначала дешёвые" },
  { value: "price-desc", label: "Сначала дорогие" },
];

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "popular";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "popular") params.delete("sort");
    else params.set("sort", value);

    // sorting reshuffles the result set — the page number from before likely
    // points at different products now, so start back at page 1
    params.delete("page");

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/catalog?${query}` : "/catalog");
    });
  }

  return (
    <Select.Root value={current} onValueChange={handleChange}>
      <Select.Trigger className={styles.trigger} aria-label="Сортировка">
        <Select.Value />
        <Select.Icon className={styles.icon}>▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={styles.content} position="popper" sideOffset={6} align="end">
          <Select.Viewport>
            {OPTIONS.map((opt) => (
              <Select.Item key={opt.value} value={opt.value} className={styles.item}>
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator className={styles.indicator}>✓</Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
