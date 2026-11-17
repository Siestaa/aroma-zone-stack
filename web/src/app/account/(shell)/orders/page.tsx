import { redirect } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageTransition } from "@/components/transitions/PageTransition";
import type { Order } from "@/lib/api/types";
import styles from "./page.module.css";

// "pickup"/"post" only ever appear on historical orders — self-pickup and
// Почта России were both retired, checkout now always submits "cdek".
const FULFILLMENT_LABEL = { pickup: "Самовывоз", post: "Почта России", cdek: "СДЭК" } as const;

export default async function OrdersPage() {
  const res = await apiFetch("/orders");
  if (res.status === 401) redirect("/account");
  if (!res.ok) throw new Error(`Failed to load orders: ${res.status}`);
  const { orders } = (await res.json()) as { orders: Order[] };

  return (
    <PageTransition>
      <div className={styles.tableWrap}>
        {orders.length === 0 ? (
          <p>Заказов пока нет.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Заказ</th>
                <th>Дата</th>
                <th>Статус</th>
                <th>Получение</th>
                <th>Сумма</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="mono" data-label="Заказ">
                    № {order.id.slice(0, 8)}
                  </td>
                  <td className="mono" data-label="Дата">
                    {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td data-label="Статус">
                    <StatusBadge status={order.status} />
                  </td>
                  <td data-label="Получение">{FULFILLMENT_LABEL[order.fulfillment]}</td>
                  <td className="price" data-label="Сумма">
                    ≈ {order.totalRub.toLocaleString("ru-RU")} ₽
                  </td>
                  <td data-label="">
                    <Link href={`/account/orders/${order.id}`} className={styles.detailsLink} transitionTypes={["nav-forward"]}>
                      Подробнее →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageTransition>
  );
}
