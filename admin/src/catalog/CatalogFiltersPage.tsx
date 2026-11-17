import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AdminCategory, CatalogFiltersConfig } from "../lib/types";
import styles from "./CatalogFiltersPage.module.css";

// Admin-curated, ordered subset of the catalog's filter-sidebar categories
// (routes/adminCatalogFilters.ts + settingsService.ts's
// getCatalogFilterCategorySlugs). Same checkbox+reorder pattern as
// HomeConfigPage's category picker, plus select-all/none since the full
// directory here is ~87 rows (vs. home's top-5 pick).
export function CatalogFiltersPage() {
  const queryClient = useQueryClient();

  const { data: allCategories } = useQuery({
    queryKey: ["admin-all-categories"],
    queryFn: () => api.get<{ categories: AdminCategory[] }>("/categories"),
  });
  const { data: config } = useQuery({
    queryKey: ["admin-catalog-filters"],
    queryFn: () => api.get<CatalogFiltersConfig>("/catalog-filters"),
  });

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [hydratedFrom, setHydratedFrom] = useState<CatalogFiltersConfig | null>(null);
  useEffect(() => {
    if (config && config !== hydratedFrom) {
      setSelectedSlugs(config.categorySlugs);
      setHydratedFrom(config);
    }
  }, [config, hydratedFrom]);

  const save = useMutation({
    mutationFn: () => api.put<CatalogFiltersConfig>("/catalog-filters", { categorySlugs: selectedSlugs }),
    onSuccess: (res) => {
      queryClient.setQueryData(["admin-catalog-filters"], res);
      setHydratedFrom(res);
    },
  });

  function toggleCategory(slug: string, checked: boolean) {
    setSelectedSlugs((prev) => (checked ? [...prev, slug] : prev.filter((s) => s !== slug)));
  }

  function moveSlug(index: number, dir: -1 | 1) {
    setSelectedSlugs((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function selectAll() {
    setSelectedSlugs((allCategories?.categories ?? []).map((c) => c.slug));
  }

  function selectNone() {
    setSelectedSlugs([]);
  }

  const categoryNameBySlug = new Map((allCategories?.categories ?? []).map((c) => [c.slug, c.name]));

  const isDirty = hydratedFrom === null || JSON.stringify(selectedSlugs) !== JSON.stringify(hydratedFrom.categorySlugs);

  return (
    <div>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Фильтры каталога</h2>
        <p className={styles.hint}>
          Список категорий в фильтре каталога на сайте. Если ничего не отмечено — показываются все категории
          автоматически, по числу товаров. Порядок ниже определяет порядок в фильтре.
        </p>

        <div className={styles.selectActions}>
          <button type="button" onClick={selectAll}>
            Отметить все
          </button>
          <button type="button" onClick={selectNone}>
            Снять все
          </button>
        </div>

        <div className={styles.checkList}>
          {(allCategories?.categories ?? []).map((cat) => (
            <label key={cat.slug} className={styles.checkRow}>
              <input
                type="checkbox"
                checked={selectedSlugs.includes(cat.slug)}
                onChange={(e) => toggleCategory(cat.slug, e.target.checked)}
              />
              {cat.name}
              <span className={styles.count}>{cat.count}</span>
            </label>
          ))}
        </div>

        <h3 className={styles.orderTitle}>Порядок в фильтре</h3>
        {selectedSlugs.length === 0 && <p className={styles.hint}>Ничего не выбрано.</p>}
        <ol className={styles.orderList}>
          {selectedSlugs.map((slug, i) => (
            <li key={slug} className={styles.orderRow}>
              <span className={styles.orderName}>{categoryNameBySlug.get(slug) ?? slug}</span>
              <div className={styles.orderActions}>
                <button type="button" disabled={i === 0} onClick={() => moveSlug(i, -1)} aria-label="Выше">
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === selectedSlugs.length - 1}
                  onClick={() => moveSlug(i, 1)}
                  aria-label="Ниже"
                >
                  ↓
                </button>
                <button type="button" onClick={() => toggleCategory(slug, false)} aria-label="Убрать">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>

        <div className={styles.saveBar}>
          <button type="button" className={styles.saveButton} disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Сохранение…" : "Сохранить"}
          </button>
          {save.isSuccess && !save.isPending && !isDirty && <span className={styles.savedHint}>Сохранено</span>}
        </div>
      </section>
    </div>
  );
}
