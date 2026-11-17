import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, resolveImageUrl } from "../lib/api";
import type { Order, OrderStatus } from "../lib/types";
import {
  FULFILLMENT_LABEL,
  formatDate,
  formatEurCents,
  formatRub,
  formatTypeLabel,
  ORDER_STATUS_LABEL,
} from "../lib/format";
import styles from "./OrderDetailPage.module.css";

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [justSaved, setJustSaved] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => api.get<Order>(`/orders/${id}`),
    enabled: Boolean(id),
  });

  const [statusDraft, setStatusDraft] = useState<OrderStatus | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [trackingDraft, setTrackingDraft] = useState<string | null>(null);
  const [trackingJustSaved, setTrackingJustSaved] = useState(false);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  const updateStatus = useMutation({
    mutationFn: (status: OrderStatus) => api.patch<Order>(`/orders/${id}/status`, { status }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin-order", id], updated);
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    },
  });

  const updateTrackingUrl = useMutation({
    mutationFn: (trackingUrl: string | null) => api.patch<Order>(`/orders/${id}/tracking-url`, { trackingUrl }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin-order", id], updated);
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setTrackingDraft(null);
      setTrackingJustSaved(true);
      setTimeout(() => setTrackingJustSaved(false), 2000);
    },
  });

  if (isLoading) return <p>Загрузка…</p>;
  if (!order) return <p>Заказ не найден</p>;

  const currentStatus = statusDraft ?? order.status;
  const currentTracking = trackingDraft ?? order.trackingUrl ?? "";

  return (
    <div>
      <button type="button" className={styles.back} onClick={() => navigate(-1)}>
        ← К списку заказов
      </button>

      <div className={styles.grid}>
        <div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Товары</h2>
            <table className={styles.itemsTable}>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.itemCell}>
                      <div className={styles.itemRow}>
                        {item.product?.imageUrl ? (
                          <button
                            type="button"
                            className={styles.thumbButton}
                            onClick={() =>
                              setLightbox({
                                src: resolveImageUrl(item.product!.imageUrl) ?? "",
                                alt: item.product!.name,
                              })
                            }
                          >
                            <img
                              src={resolveImageUrl(item.product.imageUrl) ?? undefined}
                              alt=""
                              className={styles.itemThumb}
                            />
                          </button>
                        ) : (
                          <div className={styles.itemThumbPlaceholder} aria-hidden="true" />
                        )}
                        <div className={styles.itemText}>
                          <span className={styles.itemName}>
                            {item.nameSnapshot}
                            {item.capacitySnapshot ? `, ${item.capacitySnapshot}` : ""}
                          </span>
                          {/* formatType disambiguates two variants that share a capacity
                              but are physically different (e.g. glass bottle vs eco-refill,
                              different price) — without it two such lines look identical
                              except for price, with no explanation why. */}
                          {formatTypeLabel(item.formatType) && (
                            <span className={styles.itemFormatBadge}>{formatTypeLabel(item.formatType)}</span>
                          )}
                          <span className={styles.itemSku}>{item.skuSnapshot}</span>
                          {/* item.product is a live join through productVariantId (see
                              adminOrderService.ts), not a snapshot — null for an order
                              whose variant was later removed from the catalog. */}
                          {item.product && (
                            <>
                              <span className={styles.itemOriginal}>{item.product.name}</span>
                              <a
                                href={`https://www.aroma-zone.com/info/fiche-technique/${item.product.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.itemSourceLink}
                              >
                                aroma-zone.com ↗
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={styles.itemPrice}>
                      {item.qty} × {formatEurCents(item.priceEurCentsSnapshot * item.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            {order.comment && (
              <div className={styles.row}>
                <span>Комментарий</span>
                <span>{order.comment}</span>
              </div>
            )}
            {/* Paid by the customer directly to the CDEK courier on receipt —
                not part of this order's total, just informational. */}
            <p className={styles.hint}>Стоимость доставки оплачивается покупателем курьеру при получении.</p>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Отслеживание</h2>
            <p className={styles.hint}>
              Ссылка на отслеживание посылки (например, от СДЭК) — появится у клиента на странице заказа
              кнопкой «Отследить посылку».
            </p>
            <div className={styles.statusForm}>
              <input
                className={styles.statusSelect}
                type="text"
                placeholder="https://cdek.ru/ru/tracking?..."
                value={currentTracking}
                onChange={(e) => setTrackingDraft(e.target.value)}
              />
              <button
                type="button"
                className={styles.saveButton}
                disabled={currentTracking === (order.trackingUrl ?? "") || updateTrackingUrl.isPending}
                onClick={() => updateTrackingUrl.mutate(currentTracking.trim() || null)}
              >
                Сохранить
              </button>
            </div>
            {trackingJustSaved && <p className={styles.saved}>Ссылка обновлена</p>}
          </div>
        </div>

        <div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Статус</h2>
            <div className={styles.statusForm}>
              <select
                className={styles.statusSelect}
                value={currentStatus}
                onChange={(e) => setStatusDraft(e.target.value as OrderStatus)}
              >
                {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.saveButton}
                disabled={currentStatus === order.status || updateStatus.isPending}
                onClick={() => updateStatus.mutate(currentStatus)}
              >
                Сохранить
              </button>
            </div>
            {justSaved && <p className={styles.saved}>Статус обновлён</p>}
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Контакты</h2>
            <div className={styles.row}>
              <span>Имя</span>
              <span>{order.contactName}</span>
            </div>
            <div className={styles.row}>
              <span>Email</span>
              <span>{order.contactEmail}</span>
            </div>
            <div className={styles.row}>
              <span>Телефон</span>
              <span>{order.contactPhone}</span>
            </div>
            <div className={styles.row}>
              <span>Заказ от</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Оплата</h2>
            <div className={styles.row}>
              <span>Товары</span>
              <span>{formatEurCents(order.subtotalEurCents)}</span>
            </div>
            <div className={styles.row}>
              <span>Курс</span>
              <span>{order.fxRateUsed} ₽/€</span>
            </div>
            {/* Charged to and prepaid by the customer along with the items —
                already included in totalRub below. Distinct from the
                Доставка card's CDEK note, which the customer pays separately
                and never through us. */}
            <div className={styles.row}>
              <span>Феям-помощницам</span>
              <span>{formatRub(order.helperFeeRub)}</span>
            </div>
            <div className={styles.row}>
              <span>Итого</span>
              <span>{formatRub(order.totalRub)}</span>
            </div>
            {/* Customer's own unverified claim, not proof — see
                schema.ts's customerMarkedPaidAt comment. Staff still need to
                check the actual transfer arrived before moving the status
                select above to "Оплачено". */}
            {order.customerMarkedPaidAt ? (
              <p className={`${styles.paidCallout} ${styles.paidCalloutPaid}`}>
                <span className={styles.paidCalloutDot} aria-hidden="true" />
                Клиент отметил оплату: {formatDate(order.customerMarkedPaidAt)} — проверьте поступление
                перед сменой статуса.
              </p>
            ) : (
              <p className={`${styles.paidCallout} ${styles.paidCalloutUnpaid}`}>
                <span className={styles.paidCalloutDot} aria-hidden="true" />
                Клиент ещё не отмечал оплату.
              </p>
            )}
          </div>
        </div>
      </div>

      {lightbox && (
        <div className={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox.src} alt={lightbox.alt} className={styles.lightboxImage} />
        </div>
      )}
    </div>
  );
}
