"use client";

import { startTransition, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "radix-ui";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import type { Category } from "@/lib/api/types";
import pageStyles from "./page.module.css";
import styles from "./Filters.module.css";

export function Filters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const selectedCategories = searchParams.get("category")?.split(",").filter(Boolean) ?? [];
  const bioOnly = searchParams.get("bio") === "1";
  const activeCount = selectedCategories.length + (bioOnly ? 1 : 0);

  function updateParams(next: { category?: string[]; bio?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    const categoryList = next.category ?? selectedCategories;
    const bio = next.bio ?? bioOnly;

    if (categoryList.length > 0) params.set("category", categoryList.join(","));
    else params.delete("category");

    if (bio) params.set("bio", "1");
    else params.delete("bio");

    // filters changed the result set — page N from before may no longer exist
    params.delete("page");

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/catalog?${query}` : "/catalog");
    });
  }

  function toggleCategory(slug: string, checked: boolean) {
    const next = checked
      ? [...selectedCategories, slug]
      : selectedCategories.filter((c) => c !== slug);
    updateParams({ category: next });
  }

  function resetFilters() {
    updateParams({ category: [], bio: false });
  }

  const fields = (
    <>
      <div>
        <h5>Категории</h5>
        <div className={pageStyles.categoryList}>
          {categories.map((cat) => (
            <Checkbox
              key={cat.slug}
              checked={selectedCategories.includes(cat.slug)}
              onCheckedChange={(checked) => toggleCategory(cat.slug, checked)}
              label={cat.name}
            />
          ))}
        </div>
      </div>
      <div>
        <h5>Сертификация</h5>
        <Checkbox checked={bioOnly} onCheckedChange={(checked) => updateParams({ bio: checked })} label="БИО" />
      </div>
    </>
  );

  return (
    <>
      <aside className={pageStyles.filters}>{fields}</aside>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <div className={styles.triggerWrap}>
          <Dialog.Trigger className={styles.trigger}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16l-6 7.5V18l-4 2v-7.5L4 5z" />
            </svg>
            Фильтры{activeCount > 0 ? ` (${activeCount})` : ""}
          </Dialog.Trigger>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.drawer} aria-describedby={undefined}>
            <div className={styles.drawerHeader}>
              <Dialog.Title className={styles.drawerTitle}>Фильтры</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className={styles.closeButton} aria-label="Закрыть">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </Dialog.Close>
            </div>
            <div className={`${pageStyles.filters} ${styles.drawerBody}`}>{fields}</div>
            <div className={styles.drawerFooter}>
              {activeCount > 0 && (
                <button type="button" className={styles.resetButton} onClick={resetFilters}>
                  Сбросить
                </button>
              )}
              <Dialog.Close asChild>
                <Button block>Показать товары</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
