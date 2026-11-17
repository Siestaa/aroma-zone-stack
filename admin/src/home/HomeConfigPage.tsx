import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, resolveImageUrl } from "../lib/api";
import type { AdminCategory, AdminProduct, HomeConfig, HomeConfigProduct, HomeHeroText, ProductsPage } from "../lib/types";
import styles from "./HomeConfigPage.module.css";

export function HomeConfigPage() {
  const queryClient = useQueryClient();

  const { data: allCategories } = useQuery({
    queryKey: ["admin-all-categories"],
    queryFn: () => api.get<{ categories: AdminCategory[] }>("/categories"),
  });
  const { data: config } = useQuery({
    queryKey: ["admin-home-config"],
    queryFn: () => api.get<HomeConfig>("/home-config"),
  });

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<HomeConfigProduct[]>([]);
  const [heroDraft, setHeroDraft] = useState<HomeHeroText>({ eyebrow: "", title: "", lede: "" });
  const [selectedFooterSlugs, setSelectedFooterSlugs] = useState<string[]>([]);
  // Local editable state is seeded once from the loaded config, then owned
  // entirely by the UI (checkbox/search/reorder actions) — this ref makes
  // sure a background refetch of the same query doesn't clobber in-progress
  // edits.
  const [hydratedFrom, setHydratedFrom] = useState<HomeConfig | null>(null);
  useEffect(() => {
    if (config && config !== hydratedFrom) {
      setSelectedSlugs(config.categorySlugs);
      setSelectedProducts(config.products);
      setHeroDraft(config.hero);
      setSelectedFooterSlugs(config.footerCategorySlugs);
      setHydratedFrom(config);
    }
  }, [config, hydratedFrom]);

  const [productQuery, setProductQuery] = useState("");
  const { data: searchResults } = useQuery({
    queryKey: ["admin-home-product-search", productQuery],
    queryFn: () => api.get<ProductsPage>(`/products?q=${encodeURIComponent(productQuery)}`),
    enabled: productQuery.trim().length > 1,
  });

  const save = useMutation({
    mutationFn: () =>
      api.put<HomeConfig>("/home-config", {
        categorySlugs: selectedSlugs,
        productIds: selectedProducts.map((p) => p.id),
        hero: heroDraft,
        footerCategorySlugs: selectedFooterSlugs,
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(["admin-home-config"], res);
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

  function addProduct(product: AdminProduct) {
    setSelectedProducts((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      return [...prev, { id: product.id, slug: product.slug, name: product.nameRu || product.name, imageUrl: product.imageUrl }];
    });
  }

  function removeProduct(id: string) {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  }

  function moveProduct(index: number, dir: -1 | 1) {
    setSelectedProducts((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleFooterCategory(slug: string, checked: boolean) {
    setSelectedFooterSlugs((prev) => (checked ? [...prev, slug] : prev.filter((s) => s !== slug)));
  }

  function moveFooterSlug(index: number, dir: -1 | 1) {
    setSelectedFooterSlugs((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const categoryNameBySlug = new Map((allCategories?.categories ?? []).map((c) => [c.slug, c.name]));

  const isDirty =
    hydratedFrom === null ||
    JSON.stringify(selectedSlugs) !== JSON.stringify(hydratedFrom.categorySlugs) ||
    JSON.stringify(selectedProducts.map((p) => p.id)) !== JSON.stringify(hydratedFrom.products.map((p) => p.id)) ||
    JSON.stringify(heroDraft) !== JSON.stringify(hydratedFrom.hero) ||
    JSON.stringify(selectedFooterSlugs) !== JSON.stringify(hydratedFrom.footerCategorySlugs);

  return (
    <div>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Текст на главной</h2>
        <p className={styles.hint}>Три блока сверху вниз — надпись над заголовком, заголовок, текст под ним.</p>
        <div className={styles.field}>
          <label htmlFor="hero-eyebrow">Надпись над заголовком</label>
          <input
            id="hero-eyebrow"
            value={heroDraft.eyebrow}
            onChange={(e) => setHeroDraft((prev) => ({ ...prev, eyebrow: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="hero-title">Заголовок</label>
          <input
            id="hero-title"
            value={heroDraft.title}
            onChange={(e) => setHeroDraft((prev) => ({ ...prev, title: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="hero-lede">Текст под заголовком</label>
          <textarea
            id="hero-lede"
            rows={3}
            value={heroDraft.lede}
            onChange={(e) => setHeroDraft((prev) => ({ ...prev, lede: e.target.value }))}
          />
        </div>
      </section>

      <div className={styles.grid}>
        <section className={`${styles.card} ${styles.gridCard}`}>
          <h2 className={styles.cardTitle}>Категории на главной</h2>
          <p className={styles.hint}>
            Если ничего не отмечено — показываются автоматически топ-5 категорий по числу товаров.
          </p>
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

          <h3 className={styles.orderTitle}>Порядок на главной</h3>
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
          {selectedSlugs.length > 0 && (
            <button type="button" className={styles.resetButton} onClick={() => setSelectedSlugs([])}>
              Сбросить (показывать автоматически)
            </button>
          )}
        </section>

        <section className={`${styles.card} ${styles.gridCard}`}>
          <h2 className={styles.cardTitle}>Товары в «Лидерах продаж»</h2>
          <p className={styles.hint}>Если ничего не выбрано — показываются автоматически 4 самых популярных товара.</p>
          <input
            className={styles.search}
            placeholder="Поиск товара по названию…"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
          />
          {productQuery.trim().length > 1 && (
            <div className={styles.searchResults}>
              {searchResults?.rows.length === 0 && <p className={styles.hint}>Ничего не найдено</p>}
              {searchResults?.rows.map((product) => (
                <div key={product.id} className={styles.searchRow}>
                  {product.imageUrl && (
                    <img src={resolveImageUrl(product.imageUrl) ?? undefined} alt="" className={styles.thumb} />
                  )}
                  <span className={styles.searchName}>{product.nameRu || product.name}</span>
                  <button
                    type="button"
                    className={styles.addButton}
                    disabled={selectedProducts.some((p) => p.id === product.id)}
                    onClick={() => addProduct(product)}
                  >
                    {selectedProducts.some((p) => p.id === product.id) ? "Добавлено" : "Добавить"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <h3 className={styles.orderTitle}>Порядок на главной</h3>
          {selectedProducts.length === 0 && <p className={styles.hint}>Ничего не выбрано.</p>}
          <ol className={styles.orderList}>
            {selectedProducts.map((product, i) => (
              <li key={product.id} className={styles.orderRow}>
                {product.imageUrl && (
                  <img src={resolveImageUrl(product.imageUrl) ?? undefined} alt="" className={styles.thumb} />
                )}
                <span className={styles.orderName}>{product.name}</span>
                <div className={styles.orderActions}>
                  <button type="button" disabled={i === 0} onClick={() => moveProduct(i, -1)} aria-label="Выше">
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === selectedProducts.length - 1}
                    onClick={() => moveProduct(i, 1)}
                    aria-label="Ниже"
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => removeProduct(product.id)} aria-label="Убрать">
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {selectedProducts.length > 0 && (
            <button type="button" className={styles.resetButton} onClick={() => setSelectedProducts([])}>
              Сбросить (показывать автоматически)
            </button>
          )}
        </section>

        <section className={`${styles.card} ${styles.gridCard}`}>
          <h2 className={styles.cardTitle}>Категории в футере</h2>
          <p className={styles.hint}>
            Ссылки в колонке «Каталог» в подвале сайта. Если ничего не отмечено — показываются исходные
            категории по умолчанию (Эфирные масла, Гидролаты, Флаконы и упаковка).
          </p>
          <div className={styles.checkList}>
            {(allCategories?.categories ?? []).map((cat) => (
              <label key={cat.slug} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={selectedFooterSlugs.includes(cat.slug)}
                  onChange={(e) => toggleFooterCategory(cat.slug, e.target.checked)}
                />
                {cat.name}
                <span className={styles.count}>{cat.count}</span>
              </label>
            ))}
          </div>

          <h3 className={styles.orderTitle}>Порядок в футере</h3>
          {selectedFooterSlugs.length === 0 && <p className={styles.hint}>Ничего не выбрано.</p>}
          <ol className={styles.orderList}>
            {selectedFooterSlugs.map((slug, i) => (
              <li key={slug} className={styles.orderRow}>
                <span className={styles.orderName}>{categoryNameBySlug.get(slug) ?? slug}</span>
                <div className={styles.orderActions}>
                  <button type="button" disabled={i === 0} onClick={() => moveFooterSlug(i, -1)} aria-label="Выше">
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === selectedFooterSlugs.length - 1}
                    onClick={() => moveFooterSlug(i, 1)}
                    aria-label="Ниже"
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => toggleFooterCategory(slug, false)} aria-label="Убрать">
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {selectedFooterSlugs.length > 0 && (
            <button type="button" className={styles.resetButton} onClick={() => setSelectedFooterSlugs([])}>
              Сбросить (показывать по умолчанию)
            </button>
          )}
        </section>
      </div>

      <div className={styles.saveBar}>
        <button type="button" className={styles.saveButton} disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Сохранение…" : "Сохранить"}
        </button>
        {save.isSuccess && !save.isPending && !isDirty && <span className={styles.savedHint}>Сохранено</span>}
      </div>
    </div>
  );
}
