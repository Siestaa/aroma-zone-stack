"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { clearCart, selectCartLines } from "@/lib/redux/cartSlice";
import { useCheckoutTermsQuery, useFxRateQuery, useHelperFeeQuery } from "@/lib/redux/settingsApi";
import { useMeQuery } from "@/lib/redux/authApi";
import { useClearServerCartMutation } from "@/lib/redux/cartApi";
import { formatApproxRub, formatCapacity, formatEurCents, formatTypeLabel } from "@/lib/format";
import { Field } from "@/components/ui/Field";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { checkoutSchema, type CheckoutFormValues } from "./schema";
import { useCreateOrderMutation } from "./checkoutApi";
import pageStyles from "./page.module.css";
import styles from "./CheckoutForm.module.css";

export function CheckoutForm() {
  const dispatch = useAppDispatch();
  const lines = useAppSelector(selectCartLines);
  const { data: fxRate } = useFxRateQuery();
  // 350 while the live value is still loading — matches the historical
  // default (api/src/services/settingsService.ts's DEFAULT_HELPER_FEE_RUB)
  // so there's no flash-to-0 before the query resolves.
  const { data: helperFeeRub = 350 } = useHelperFeeQuery();
  // Same fallback values as the backend default (settingsService.ts's
  // DEFAULT_CHECKOUT_TERMS) — avoids a flash of empty checkbox text before
  // the query resolves.
  const {
    data: checkoutTerms = {
      text: "Я ознакомлен с",
      linkText: "условиями покупки",
      linkUrl: "https://vk.ru/topic-106767595_32881163",
    },
  } = useCheckoutTermsQuery();
  const { data: user } = useMeQuery();
  const [createOrder, { isLoading: isSubmitting }] = useCreateOrderMutation();
  const [clearServerCart] = useClearServerCartMutation();
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const subtotalEurCents = lines.reduce((sum, l) => sum + l.priceEurCents * l.qty, 0);
  const subtotalRub = fxRate ? Math.round((subtotalEurCents / 100) * fxRate) : 0;
  const totalRub = subtotalRub + helperFeeRub;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
  });

  // Prefill contact fields (and the saved address, if any — see
  // /account/addresses) from the logged-in account once per login (ref
  // keyed on user id, same convention as CartSync's merge-once guard) —
  // fires after useMeQuery resolves client-side, since defaultValues can't
  // see that data at mount. Only runs once so it doesn't clobber edits the
  // user makes afterward (e.g. a different phone or address for this
  // particular order).
  const prefilledForUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!user || prefilledForUserId.current === user.id) return;
    prefilledForUserId.current = user.id;
    reset({
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      city: user.city ?? "",
      address: user.address ?? "",
    });
  }, [user, reset]);

  async function onSubmit(values: CheckoutFormValues) {
    setSubmitError(null);
    try {
      await createOrder({
        items: lines.map((l) => ({ productVariantId: l.productVariantId, qty: l.qty })),
        // Self-pickup and Почта России were both retired — every order
        // ships via CDEK now, no method to choose.
        fulfillment: "cdek",
        city: values.city,
        address: values.address,
        comment: values.comment,
        contactName: values.name,
        contactEmail: values.email,
        contactPhone: values.phone,
      }).unwrap();
      if (user) await clearServerCart().unwrap().catch(() => {});
      dispatch(clearCart());
      setSubmitted(true);
    } catch {
      setSubmitError("Не получилось отправить заказ. Попробуйте ещё раз.");
    }
  }

  if (submitted) {
    return (
      <div className={`${pageStyles.success} ${styles.success}`}>
        <div className={styles.checkmark}>✓</div>
        <h1>Заказ отправлен на подтверждение</h1>
        <p>
          Мы выкупим его во Франции после поступления оплаты. Откройте заказ в «Мои заказы»,
          нажмите «Оплатить», переведите сумму по показанным реквизитам и отметьте «Я оплатил» —
          после подтверждения заказ уходит в закупку.
        </p>
        <Button href="/account/orders">Мои заказы</Button>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className={pageStyles.success}>
        <h1>Корзина пуста</h1>
        <p>Добавьте товары, чтобы оформить заказ.</p>
        <Button href="/catalog">В каталог</Button>
      </div>
    );
  }

  return (
    <div className={pageStyles.layout}>
      <form
        id="checkout-form"
        className={pageStyles.form}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <div className={pageStyles.group}>
          <h2>Контактные данные</h2>
          <div className={pageStyles.stack}>
            <Field label="Имя" placeholder="Как к вам обращаться" error={errors.name?.message} {...register("name")} />
            <Field
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <Field
              label="Телефон"
              type="tel"
              placeholder="+7 900 000-00-00"
              note="Понадобится для связи и возврата переплаты, если сумма изменится по курсу"
              error={errors.phone?.message}
              {...register("phone")}
            />
          </div>
        </div>

        <div className={pageStyles.group}>
          <h2>Доставка</h2>
          <p className={pageStyles.disclaimer}>
            СДЭК — стоимость оплачивается отдельно, курьеру при получении заказа. В сумму предоплаты
            ниже не входит.
          </p>
          <div className={pageStyles.stack}>
            <Field label="Город" placeholder="Город" error={errors.city?.message} {...register("city")} />
            <Field
              label="Адрес пункта выдачи СДЭК"
              placeholder="Адрес офиса ПВЗ СДЭК"
              note={
                <>
                  Нужен адрес конкретного пункта выдачи, не адрес получателя — найти ближайший можно{" "}
                  <a
                    href="https://www.cdek.ru/ru/offices/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.inlineLink}
                  >
                    на сайте СДЭК ↗
                  </a>
                </>
              }
              error={errors.address?.message}
              {...register("address")}
            />
          </div>
        </div>

        <div className={pageStyles.group}>
          <h2>Комментарий к заказу</h2>
          <Field as="textarea" label="Комментарий" placeholder="Необязательно" {...register("comment")} />
        </div>
      </form>

      <div className={pageStyles.summary}>
        <span className={pageStyles.recapEyebrow}>Ваш заказ</span>
        <div className={pageStyles.recap}>
          {lines.map((line) => (
            <div className={pageStyles.recapRow} key={line.productVariantId}>
              <span>
                {line.productName}, {formatCapacity(line.capacity, line.capacityUnit)}
                {formatTypeLabel(line.formatType) && (
                  <span className={pageStyles.formatBadge}>{formatTypeLabel(line.formatType)}</span>
                )}
                <span className={pageStyles.qty}>×{line.qty}</span>
              </span>
              <span className="mono">{formatEurCents(line.priceEurCents * line.qty)}</span>
            </div>
          ))}
        </div>
        <div className={pageStyles.line}>
          <span>Подытог, по курсу сегодня</span>
          <span className="mono">
            {formatEurCents(subtotalEurCents)} · {formatApproxRub(subtotalRub)}
          </span>
        </div>
        <div className={pageStyles.line}>
          <span>Оплата феям-помощницам</span>
          <span className="mono">{formatApproxRub(helperFeeRub)}</span>
        </div>
        <div className={pageStyles.total}>
          <span>К предоплате сейчас</span>
          <span className="mono">{formatApproxRub(totalRub)}</span>
        </div>
        <p className={pageStyles.disclaimer}>
          Без учёта доставки — СДЭК оплачивается отдельно, курьеру при получении заказа.
        </p>
        <p className={pageStyles.disclaimer}>
          Сумма в рублях — курс ЦБ с наценкой за растаможку, точно пересчитывается на день выкупа во
          Франции — при разнице сообщим на email до отправки.
        </p>
        <div>
          {/* The link is a sibling of <Checkbox>'s <label>, not a descendant
              of it — nesting an <a> inside the label lets the browser's
              native "click inside a label activates its control" behavior
              fire even with stopPropagation() on the link's own click
              handler (real mouse clicks toggled the checkbox anyway; only
              a JS-triggered .click() respected stopPropagation, which is
              why this wasn't caught before real-browser testing). Keeping
              the link outside the <label> avoids that browser behavior
              entirely instead of fighting it. */}
          <div className={styles.termsRow}>
            <Controller
              name="agreedToTerms"
              control={control}
              render={({ field }) => (
                <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} label={checkoutTerms.text} />
              )}
            />
            <a
              href={checkoutTerms.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.inlineLink}
            >
              {checkoutTerms.linkText} ↗
            </a>
          </div>
          {errors.agreedToTerms && <p className={pageStyles.disclaimer}>{errors.agreedToTerms.message}</p>}
        </div>
        {submitError && <p className={pageStyles.disclaimer}>{submitError}</p>}
        <Button type="submit" form="checkout-form" block disabled={isSubmitting}>
          {isSubmitting ? "Отправляем…" : "Отправить заказ на подтверждение"}
        </Button>
        <p className={pageStyles.disclaimer}>
          Дальше — в «Мои заказы» откройте этот заказ, нажмите «Оплатить», переведите сумму по
          реквизитам и отметьте «Я оплатил». 100% предоплата, заказ уходит в закупку после
          подтверждения оплаты.
        </p>
      </div>
    </div>
  );
}
