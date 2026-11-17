"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { useMarkOrderPaidMutation } from "../ordersApi";
import styles from "./PaymentAction.module.css";

// Only rendered by the order detail page while status is still "collecting"
// (see page.tsx) — once staff move it past that, this component doesn't
// mount at all, so there's no separate "already paid" branch to handle here.
export function PaymentAction({
  orderId,
  totalRub,
  requisitesText,
  initialMarkedPaidAt,
}: {
  orderId: string;
  totalRub: number;
  requisitesText: string;
  initialMarkedPaidAt: string | null;
}) {
  const [markedPaidAt, setMarkedPaidAt] = useState(initialMarkedPaidAt);
  const [open, setOpen] = useState(false);
  const [markPaid, { isLoading }] = useMarkOrderPaidMutation();

  async function handleMarkPaid() {
    try {
      const updated = await markPaid(orderId).unwrap();
      setMarkedPaidAt(updated.customerMarkedPaidAt);
    } catch {
      setMarkedPaidAt(new Date().toISOString());
    }
    setOpen(false);
  }

  // This is the customer's own unverified claim, not proof — staff still
  // check the actual transfer before moving the order's real status past
  // "collecting" (see admin's OrderDetailPage.tsx).
  if (markedPaidAt) {
    return (
      <p className={styles.waiting}>
        Вы отметили оплату {new Date(markedPaidAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}{" "}
        — ждём подтверждения.
      </p>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={styles.payButton}>
          Оплатить
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <Dialog.Title className={styles.title}>Оплата заказа</Dialog.Title>
          <div className={styles.amountRow}>
            <span>Сумма к переводу</span>
            <span className={`mono ${styles.amount}`}>{totalRub.toLocaleString("ru-RU")} ₽</span>
          </div>
          {requisitesText.trim() ? (
            <pre className={styles.requisites}>{requisitesText}</pre>
          ) : (
            <p className={styles.fallback}>Реквизиты для оплаты пришли вам на email при оформлении заказа.</p>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.laterButton} onClick={() => setOpen(false)}>
              Позже
            </button>
            <button type="button" className={styles.confirmButton} disabled={isLoading} onClick={handleMarkPaid}>
              {isLoading ? "Отмечаем…" : "Я оплатил"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
