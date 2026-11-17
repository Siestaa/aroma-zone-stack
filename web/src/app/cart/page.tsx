"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppSelector } from "@/lib/redux/hooks";
import { selectCartLines } from "@/lib/redux/cartSlice";
import { useFxRateQuery } from "@/lib/redux/settingsApi";
import { formatApproxRub, formatEurCents } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/transitions/PageTransition";
import { CartRow } from "./CartRow";
import styles from "./page.module.css";

export default function CartPage() {
  const lines = useAppSelector(selectCartLines);
  const { data: fxRate } = useFxRateQuery();
  const [promoCode, setPromoCode] = useState("");
  const [promoNote, setPromoNote] = useState<string | null>(null);

  const subtotalCents = lines.reduce((sum, l) => sum + l.priceEurCents * l.qty, 0);
  const subtotalRub = fxRate ? Math.round((subtotalCents / 100) * fxRate) : 0;

  return (
    <PageTransition>
      <main>
        <h1 className={styles.title}>Корзина</h1>
        {lines.length === 0 ? (
          <div className={styles.empty}>
            <p>Корзина пуста.</p>
            <p style={{ marginTop: 12 }}>
              <Link
                href="/catalog"
                className="tap-target"
                style={{ textDecoration: "underline" }}
                transitionTypes={["nav-back"]}
              >
                Перейти в каталог
              </Link>
            </p>
          </div>
        ) : (
          <div className={styles.layout}>
            <div className={styles.items}>
              {lines.map((line) => (
                <CartRow key={line.productVariantId} line={line} approxRubPerEur={fxRate ?? 0} />
              ))}
            </div>
            <div className={styles.summary}>
              <div className={styles.line}>
                <span>Подытог, по курсу сегодня</span>
                <span className="mono">
                  {formatEurCents(subtotalCents)} · {formatApproxRub(subtotalRub)}
                </span>
              </div>
              <div className={styles.promo}>
                <input
                  type="text"
                  placeholder="Промокод"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value);
                    setPromoNote(null);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => setPromoNote(promoCode.trim() ? "Промокоды пока не поддерживаются" : null)}
                >
                  OK
                </Button>
              </div>
              {promoNote && <p className={styles.disclaimer}>{promoNote}</p>}
              <p className={styles.disclaimer}>
                На следующем шаге добавится оплата феям-помощницам. Доставка — СДЭК, оплачивается
                отдельно курьеру при получении. Сумма в рублях — курс ЦБ с наценкой за растаможку, точно
                пересчитывается на день выкупа во Франции — если разница существенная, сообщим на email
                до отправки.
              </p>
              <Button href="/checkout" block transitionTypes={["nav-forward"]}>
                Оформить заказ
              </Button>
              <p className={styles.disclaimer}>
                Оплата — картой на карту по реквизитам из письма-подтверждения. 100% предоплата.
              </p>
            </div>
          </div>
        )}
      </main>
    </PageTransition>
  );
}
