import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { OrdersPage } from "../lib/types";
import { formatDate, formatRub, ORDER_STATUS_LABEL } from "../lib/format";
import styles from "./OrdersListPage.module.css";

export function OrdersListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const q = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page") ?? "1");

  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (q) query.set("q", q);
  query.set("page", String(page));

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", status, q, page],
    queryFn: () => api.get<OrdersPage>(`/orders?${query.toString()}`),
  });

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
        <form
          className={styles.searchForm}
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement;
            updateParam("q", input.value.trim());
          }}
        >
          <input
            name="q"
            className={styles.search}
            placeholder="Поиск по имени, email, телефону, номеру заказа…"
            defaultValue={q}
            onBlur={(e) => updateParam("q", e.currentTarget.value.trim())}
          />
          <button type="submit" className={styles.searchButton}>
            Найти
          </button>
        </form>
        <select className={styles.statusSelect} value={status} onChange={(e) => updateParam("status", e.target.value)}>
          <option value="">Все статусы</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p>Загрузка…</p>}

      {data && data.rows.length === 0 && <div className={styles.empty}>Заказов не найдено</div>}

      {data && data.rows.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Заказ</th>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Статус</th>
              <th>Сумма</th>
              <th>Товаров</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((order) => (
              <tr key={order.id} onClick={() => navigate(`/orders/${order.id}`)}>
                <td title={order.id}>№ {order.id.slice(0, 8)}</td>
                <td>{formatDate(order.createdAt)}</td>
                <td>
                  {order.contactName}
                  <br />
                  <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>{order.contactPhone}</span>
                </td>
                <td>
                  {!order.viewedByAdminAt && <span className={styles.newBadge}>Новый</span>}
                  <span className={styles.badge}>{ORDER_STATUS_LABEL[order.status]}</span>
                </td>
                <td>{formatRub(order.totalRub)}</td>
                <td>{order.items.reduce((sum, i) => sum + i.qty, 0)}</td>
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
    </div>
  );
}
