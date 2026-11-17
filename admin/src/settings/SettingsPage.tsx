import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import styles from "./SettingsPage.module.css";

type Step = { kind: "idle" } | { kind: "qr"; qrDataUrl: string } | { kind: "done" };

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: helperFee } = useQuery({
    queryKey: ["admin-helper-fee"],
    queryFn: () => api.get<{ rub: number }>("/settings/helper-fee"),
  });
  const [helperFeeInput, setHelperFeeInput] = useState("");
  const [helperFeeHydrated, setHelperFeeHydrated] = useState(false);
  useEffect(() => {
    if (helperFee && !helperFeeHydrated) {
      setHelperFeeInput(String(helperFee.rub));
      setHelperFeeHydrated(true);
    }
  }, [helperFee, helperFeeHydrated]);

  const saveHelperFee = useMutation({
    mutationFn: (rub: number) => api.patch<{ rub: number }>("/settings/helper-fee", { rub }),
  });

  const { data: fxRate } = useQuery({
    queryKey: ["admin-fx-rate"],
    queryFn: () => api.get<{ cbrRate: number; markupRub: number; effectiveRate: number }>("/settings/fx-rate"),
  });
  const [markupInput, setMarkupInput] = useState("");
  const [markupHydrated, setMarkupHydrated] = useState(false);
  useEffect(() => {
    if (fxRate && !markupHydrated) {
      setMarkupInput(String(fxRate.markupRub));
      setMarkupHydrated(true);
    }
  }, [fxRate, markupHydrated]);

  const saveMarkup = useMutation({
    mutationFn: (markupRub: number) => api.patch<{ markupRub: number }>("/settings/fx-rate", { markupRub }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-fx-rate"] }),
  });

  const { data: requisites } = useQuery({
    queryKey: ["admin-payment-requisites"],
    queryFn: () => api.get<{ text: string }>("/settings/payment-requisites"),
  });
  const [requisitesInput, setRequisitesInput] = useState("");
  const [requisitesHydrated, setRequisitesHydrated] = useState(false);
  useEffect(() => {
    if (requisites && !requisitesHydrated) {
      setRequisitesInput(requisites.text);
      setRequisitesHydrated(true);
    }
  }, [requisites, requisitesHydrated]);

  const saveRequisites = useMutation({
    mutationFn: (text: string) => api.patch<{ text: string }>("/settings/payment-requisites", { text }),
  });

  type CheckoutTerms = { text: string; linkText: string; linkUrl: string };
  const { data: checkoutTerms } = useQuery({
    queryKey: ["admin-checkout-terms"],
    queryFn: () => api.get<CheckoutTerms>("/settings/checkout-terms"),
  });
  const [checkoutTermsDraft, setCheckoutTermsDraft] = useState<CheckoutTerms>({
    text: "",
    linkText: "",
    linkUrl: "",
  });
  const [checkoutTermsHydrated, setCheckoutTermsHydrated] = useState(false);
  useEffect(() => {
    if (checkoutTerms && !checkoutTermsHydrated) {
      setCheckoutTermsDraft(checkoutTerms);
      setCheckoutTermsHydrated(true);
    }
  }, [checkoutTerms, checkoutTermsHydrated]);

  const saveCheckoutTerms = useMutation({
    mutationFn: (content: CheckoutTerms) => api.patch<CheckoutTerms>("/settings/checkout-terms", content),
  });

  const startReset = useMutation({
    mutationFn: () => api.post<{ qrDataUrl: string }>("/settings/totp/reset"),
    onSuccess: (res) => {
      setError(null);
      setCode("");
      setStep({ kind: "qr", qrDataUrl: res.qrDataUrl });
    },
  });

  const confirmReset = useMutation({
    mutationFn: (code: string) => api.post<{ ok: true }>("/settings/totp/reset/confirm", { code }),
    onSuccess: () => {
      setError(null);
      setStep({ kind: "done" });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Ошибка"),
  });

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    confirmReset.mutate(code);
  }

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Перепривязка устройства для 2FA</h2>
        <p className={styles.hint}>
          Если вы сменили телефон или потеряли доступ к приложению-аутентификатору, привяжите новое устройство.
          Текущее устройство продолжит работать, пока вы не подтвердите код с нового.
        </p>

        {step.kind === "idle" && (
          <button
            type="button"
            className={styles.startButton}
            disabled={startReset.isPending}
            onClick={() => startReset.mutate()}
          >
            Показать новый QR-код
          </button>
        )}

        {step.kind === "qr" && (
          <form onSubmit={handleConfirm}>
            <p className={styles.hint}>
              Отсканируйте QR-код новым устройством в Google Authenticator / Яндекс.Ключ, затем введите код,
              который оно показывает — это подтвердит привязку и отключит старое устройство.
            </p>
            <img src={step.qrDataUrl} alt="QR-код для 2FA" className={styles.qr} />
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.field}>
              <label htmlFor="code">Код с нового устройства</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.startButton} disabled={confirmReset.isPending || code.length !== 6}>
                Подтвердить
              </button>
              <button type="button" className={styles.cancelButton} onClick={() => setStep({ kind: "idle" })}>
                Отмена
              </button>
            </div>
          </form>
        )}

        {step.kind === "done" && (
          <>
            <p className={styles.success}>Готово — новое устройство привязано, старое больше не действует.</p>
            <button type="button" className={styles.startButton} onClick={() => setStep({ kind: "idle" })}>
              Перепривязать ещё раз
            </button>
          </>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Оплата феям-помощницам</h2>
        <p className={styles.hint}>
          Сколько платим помощницам за каждый заказ — показывается клиенту на чекауте и входит в
          предоплату. Отдельно от доставки (СДЭК) — её покупатель оплачивает курьеру при получении, не
          через нас.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const rub = Number(helperFeeInput);
            if (Number.isFinite(rub) && rub >= 0) saveHelperFee.mutate(rub);
          }}
        >
          <div className={styles.field}>
            <label htmlFor="helper-fee-rub">Сумма за заказ, ₽</label>
            <input
              id="helper-fee-rub"
              type="number"
              min={0}
              step={1}
              required
              value={helperFeeInput}
              onChange={(e) => setHelperFeeInput(e.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.startButton} disabled={saveHelperFee.isPending}>
              {saveHelperFee.isPending ? "Сохранение…" : "Сохранить"}
            </button>
            {saveHelperFee.isSuccess &&
              !saveHelperFee.isPending &&
              helperFeeInput === String(saveHelperFee.data?.rub) && <span className={styles.success}>Сохранено</span>}
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Курс евро</h2>
        <p className={styles.hint}>
          Клиентам показывается курс ЦБ на сегодня плюс наценка (растаможка и наши расходы) — сама наценка
          настраивается здесь, курс ЦБ подтягивается автоматически каждую ночь и не редактируется вручную.
        </p>
        {fxRate && (
          <p className={styles.hint}>
            Курс ЦБ сегодня: {fxRate.cbrRate.toFixed(2)} ₽ · Итоговый курс для клиентов:{" "}
            <b>{fxRate.effectiveRate.toFixed(2)} ₽</b>
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const rub = Number(markupInput);
            if (Number.isFinite(rub) && rub >= 0) saveMarkup.mutate(rub);
          }}
        >
          <div className={styles.field}>
            <label htmlFor="fx-markup-rub">Наценка, ₽</label>
            <input
              id="fx-markup-rub"
              type="number"
              min={0}
              step={1}
              required
              value={markupInput}
              onChange={(e) => setMarkupInput(e.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.startButton} disabled={saveMarkup.isPending}>
              {saveMarkup.isPending ? "Сохранение…" : "Сохранить"}
            </button>
            {saveMarkup.isSuccess && !saveMarkup.isPending && markupInput === String(saveMarkup.data?.markupRub) && (
              <span className={styles.success}>Сохранено</span>
            )}
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Реквизиты для оплаты</h2>
        <p className={styles.hint}>
          Показывается клиенту в модалке «Оплатить» на странице его заказов — номер карты, получатель,
          банк, что нужно. Если оставить пустым, клиенту вместо этого предложат посмотреть реквизиты в
          письме на почту (как сейчас).
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveRequisites.mutate(requisitesInput);
          }}
        >
          <div className={styles.field}>
            <label htmlFor="payment-requisites">Текст реквизитов</label>
            <textarea
              id="payment-requisites"
              rows={4}
              placeholder="Например: Карта Тинькофф 2200 xxxx xxxx xxxx, получатель Имя Фамилия"
              value={requisitesInput}
              onChange={(e) => setRequisitesInput(e.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.startButton} disabled={saveRequisites.isPending}>
              {saveRequisites.isPending ? "Сохранение…" : "Сохранить"}
            </button>
            {saveRequisites.isSuccess && !saveRequisites.isPending && requisitesInput === saveRequisites.data?.text && (
              <span className={styles.success}>Сохранено</span>
            )}
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Условия покупки на чекауте</h2>
        <p className={styles.hint}>
          Текст рядом с обязательным чекбоксом «Я ознакомлен с условиями покупки» на странице
          оформления заказа — текст перед ссылкой, текст самой ссылки и адрес, куда она ведёт.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveCheckoutTerms.mutate(checkoutTermsDraft);
          }}
        >
          <div className={styles.field}>
            <label htmlFor="checkout-terms-text">Текст перед ссылкой</label>
            <input
              id="checkout-terms-text"
              required
              value={checkoutTermsDraft.text}
              onChange={(e) => setCheckoutTermsDraft({ ...checkoutTermsDraft, text: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="checkout-terms-link-text">Текст ссылки</label>
            <input
              id="checkout-terms-link-text"
              required
              value={checkoutTermsDraft.linkText}
              onChange={(e) => setCheckoutTermsDraft({ ...checkoutTermsDraft, linkText: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="checkout-terms-link-url">Адрес ссылки</label>
            <input
              id="checkout-terms-link-url"
              type="url"
              required
              value={checkoutTermsDraft.linkUrl}
              onChange={(e) => setCheckoutTermsDraft({ ...checkoutTermsDraft, linkUrl: e.target.value })}
            />
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.startButton} disabled={saveCheckoutTerms.isPending}>
              {saveCheckoutTerms.isPending ? "Сохранение…" : "Сохранить"}
            </button>
            {saveCheckoutTerms.isSuccess &&
              !saveCheckoutTerms.isPending &&
              JSON.stringify(checkoutTermsDraft) === JSON.stringify(saveCheckoutTerms.data) && (
                <span className={styles.success}>Сохранено</span>
              )}
          </div>
        </form>
      </div>
    </div>
  );
}
