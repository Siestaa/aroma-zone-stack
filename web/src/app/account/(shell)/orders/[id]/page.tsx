import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { apiFetch, apiGet } from "@/lib/api/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageTransition } from "@/components/transitions/PageTransition";
import { formatEurCents } from "@/lib/format";
import type { Order } from "@/lib/api/types";
import { PaymentAction } from "./PaymentAction";
import styles from "./page.module.css";

// "pickup"/"post" only ever appear on historical orders — self-pickup and
// Почта России were both retired, checkout now always submits "cdek".
const FULFILLMENT_LABEL = { pickup: "Самовывоз", post: "Почта России", cdek: "СДЭК" } as const;

export default async function OrderDetailPage({ params }: PageProps<"/account/orders/[id]">) {
  const { id } = await params;

  const [orderRes, requisites] = await Promise.all([
    apiFetch(`/orders/${id}`),
    apiGet<{ text: string }>("/payment-requisites"),
  ]);
  if (orderRes.status === 401) redirect("/account");
  if (orderRes.status === 404) notFound();
  if (!orderRes.ok) throw new Error(`Failed to load order: ${orderRes.status}`);
  const order = (await orderRes.json()) as Order;

  return (
    <PageTransition>
      <div className={styles.page}>
        <Link href="/account/orders" className={styles.back} transitionTypes={["nav-back"]}>
          ← Все заказы
        </Link>

        <div className={styles.header}>
          <h1 className={styles.title}>Заказ № {order.id.slice(0, 8)}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className={styles.date}>от {new Date(order.createdAt).toLocaleDateString("ru-RU")}</p>

        {order.status === "cancelled" && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Причина отмены</h2>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{order.cancellationReason}</p>
            <p>Если заказ уже оплачен, свяжитесь с нами для уточнения возврата.</p>
            <Link href="/contacts">Связаться с нами</Link>
          </div>
        )}
        <div className={styles.layout}>
          <div className={styles.stack}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Товары</h2>
              {order.items.map((item) => (
                <div className={styles.itemRow} key={item.id}>
                  <span>
                    {item.nameSnapshot}
                    {item.capacitySnapshot ? `, ${item.capacitySnapshot}` : ""}
                    <span className={styles.qty}>×{item.qty}</span>
                  </span>
                  <span className="mono">{formatEurCents(item.priceEurCentsSnapshot * item.qty)}</span>
                </div>
              ))}
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Доставка</h2>
              <div className={styles.row}>
                <span>Способ</span>
                <span>{FULFILLMENT_LABEL[order.fulfillment]}</span>
              </div>
              {order.city && (
                <div className={styles.row}>
                  <span>Город</span>
                  <span>{order.city}</span>
                </div>
              )}
              {order.address && (
                <div className={styles.row}>
                  <span>Адрес</span>
                  <span>{order.address}</span>
                </div>
              )}
              <p className={styles.hint}>Стоимость доставки оплачивается курьеру при получении, отдельно от заказа.</p>
              {order.trackingUrl && order.status !== "cancelled" && (
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.trackButton} tap-target`}
                >
                  Ссылка для отслеживания посылки ↗
                </a>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Оплата</h2>
            <div className={styles.row}>
              <span>Товары</span>
              <span className="mono">{formatEurCents(order.subtotalEurCents)}</span>
            </div>
            <div className={styles.row}>
              <span>Феям-помощницам</span>
              <span className="mono">{order.helperFeeRub.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className={styles.total}>
              <span>Итого</span>
              <span className="mono">{order.totalRub.toLocaleString("ru-RU")} ₽</span>
            </div>

            {order.status === "collecting" && (
              <div className={styles.paymentAction}>
                <PaymentAction
                  orderId={order.id}
                  totalRub={order.totalRub}
                  requisitesText={requisites?.text ?? ""}
                  initialMarkedPaidAt={order.customerMarkedPaidAt}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
