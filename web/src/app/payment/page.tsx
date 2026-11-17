import { apiGet } from "@/lib/api/server";
import { PageTransition } from "@/components/transitions/PageTransition";
import styles from "@/app/_shared/InfoPage.module.css";

// Original hardcoded copy — used only if /api/pages/payment itself fails.
// Blocks all render as .notice cards now (was: 1 .notice + 2 .methodCard
// in a 2-col grid) — reordering blocks in admin only makes sense if every
// position looks the same, so the visual split was dropped in favor of one
// consistent style per page (see infoPagesService.ts's InfoPageContent).
const FALLBACK = {
  eyebrow: "Оплата",
  title: "Оплата картой, сумма — по курсу на день выкупа",
  lede: "После оформления заказа на email приходит подтверждение с суммой по текущему курсу. Перевод — картой на карту, указанную в письме. Заказ подтверждается только после 100% предоплаты.",
  blocks: [
    {
      title: "Почему сумма в рублях не равна курсу ЦБ",
      body: "Мы берём официальный курс ЦБ и добавляем фиксированную наценку — она покрывает растаможку заказа при ввозе в Россию, отдельно от стоимости доставки. Поэтому сумма в письме будет немного выше курса ЦБ — это не ошибка и не наша прибыль сверху цены товара, а часть расходов на то, чтобы посылка вообще доехала. Считаем по курсу на день выкупа заказа во Франции, а не на день оформления: при недоплате нужно доплатить остаток на ту же карту, при переплате — вернём разницу на телефон, указанный при регистрации.",
    },
    {
      title: "Как это выглядит по шагам",
      body: "1. Оформляете заказ → 2. Письмо с суммой и реквизитами → 3. Перевод картой на карту → 4. Вы — участник закупки цикла.",
    },
    {
      title: "Если сумма изменилась",
      body: "Курс на день выкупа отличается от дня заказа — почти всегда. Разницу закрываем доплатой или возвратом на телефон.",
    },
  ],
};

export default async function PaymentPage() {
  const content =
    (await apiGet<{
      eyebrow: string;
      title: string;
      lede: string;
      blocks: { title: string; body: string }[];
    }>("/pages/payment")) ?? FALLBACK;

  return (
    <PageTransition>
      <main className={styles.page}>
        <div>
          <span className={styles.eyebrow}>{content.eyebrow}</span>
          <h1 className={styles.title}>{content.title}</h1>
        </div>
        <p className={styles.lede}>{content.lede}</p>
        {content.blocks.map((block, i) => (
          <div key={i} className={styles.notice}>
            <b>{block.title}</b>
            {block.body}
          </div>
        ))}
      </main>
    </PageTransition>
  );
}
