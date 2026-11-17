import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api, resolveImageUrl } from "../lib/api";
import type { AdminProduct, ProductsPage, SyncStatus } from "../lib/types";
import { formatCountdown, formatDate } from "../lib/format";
import { ProductEditModal } from "./ProductEditModal";
import styles from "./ProductsListPage.module.css";

export function ProductsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const untranslated = searchParams.get("untranslated") === "1";
  const page = Number(searchParams.get("page") ?? "1");
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const queryClient = useQueryClient();

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (untranslated) query.set("untranslated", "true");
  query.set("page", String(page));

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", q, untranslated, page],
    queryFn: () => api.get<ProductsPage>(`/products?${query.toString()}`),
  });

  const toggleHidden = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => api.patch(`/products/${id}`, { hidden }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const { data: syncStatus } = useQuery({
    queryKey: ["products-sync-status"],
    queryFn: () => api.get<SyncStatus>("/products/sync-status"),
    refetchInterval: (query) => (query.state.data?.running ? 3000 : 30_000),
  });

  const triggerSync = useMutation({
    mutationFn: () => api.post<SyncStatus>("/products/sync"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products-sync-status"] }),
  });

  // Refresh the product list itself once a running sync flips back to idle
  // (picked up by the sync-status poll above), not right when the button is
  // clicked — the sync runs in the background and takes a while.
  const [wasSyncing, setWasSyncing] = useState(false);
  useEffect(() => {
    if (!syncStatus) return;
    if (syncStatus.running) setWasSyncing(true);
    else if (wasSyncing) {
      setWasSyncing(false);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    }
  }, [syncStatus, wasSyncing, queryClient]);

  // Re-render every 30s purely to keep the "next sync in …" countdown text
  // fresh — the value itself comes from syncStatus, not this state.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next);
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Поиск по названию…"
          defaultValue={q}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateParam("q", e.currentTarget.value.trim());
          }}
          onBlur={(e) => updateParam("q", e.currentTarget.value.trim())}
        />
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={untranslated}
            onChange={(e) => updateParam("untranslated", e.target.checked ? "1" : "")}
          />
          Только без перевода
        </label>
        <div className={styles.syncBlock}>
          <button
            type="button"
            className={styles.syncButton}
            disabled={triggerSync.isPending || syncStatus?.running}
            onClick={() => triggerSync.mutate()}
          >
            {syncStatus?.running ? "Обновляется…" : "Обновить список"}
          </button>
          {syncStatus && !syncStatus.running && (
            <span className={styles.syncHint}>
              Следующее автообновление через {formatCountdown(syncStatus.nextScheduledAt)}
            </span>
          )}
        </div>
      </div>

      {isLoading && <p>Загрузка…</p>}

      {data && data.rows.length === 0 && <div className={styles.empty}>Товары не найдены</div>}

      {data && data.rows.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th />
              <th>Название</th>
              <th>Синк</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((product) => (
              <tr key={product.id}>
                <td>
                  {product.imageUrl && (
                    <img src={resolveImageUrl(product.imageUrl) ?? undefined} alt="" className={styles.thumb} />
                  )}
                </td>
                <td className={styles.nameCell}>
                  {product.nameRu || product.name}
                  {!product.nameRu && <span className={styles.untranslatedBadge}>нет перевода</span>}
                  {product.hidden && <span className={styles.hiddenBadge}>скрыт</span>}
                  <div className={styles.nameFr}>{product.name}</div>
                </td>
                <td>{formatDate(product.lastSyncedAt)}</td>
                <td>
                  <button type="button" className={styles.editButton} onClick={() => setEditing(product)}>
                    Редактировать
                  </button>
                  <button
                    type="button"
                    className={styles.hideButton}
                    disabled={toggleHidden.isPending}
                    onClick={() => toggleHidden.mutate({ id: product.id, hidden: !product.hidden })}
                  >
                    {product.hidden ? "Показать" : "Скрыть"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && data.totalPages > 1 && (
        <div className={styles.pagination}>
          <button type="button" disabled={data.currentPage <= 1} onClick={() => goToPage(data.currentPage - 1)}>
            ← Назад
          </button>
          <span>
            {data.currentPage} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={data.currentPage >= data.totalPages}
            onClick={() => goToPage(data.currentPage + 1)}
          >
            Вперёд →
          </button>
        </div>
      )}

      {editing && <ProductEditModal product={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
