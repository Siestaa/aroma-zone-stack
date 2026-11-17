import { apiGet } from "@/lib/api/server";
import { pageMetadata } from "@/lib/seo";
import { PageTransition } from "@/components/transitions/PageTransition";
import styles from "@/app/_shared/InfoPage.module.css";

export const metadata = pageMetadata(
  "/about", "О совместных закупках Aroma-Zone",
  "Как устроена совместная закупка Aroma-Zone: от оформления заказа до выкупа товаров во Франции и отправки из Омска.",
);

// Original hardcoded copy — used only if /api/pages/about itself fails
// (the endpoint's own default already covers "never edited in admin", see
// api/src/services/infoPagesService.ts).
const FALLBACK = {
  eyebrow: "О сервисе",
  title: "Мы организуем совместную закупку товаров с сайта Aroma-Zone",
  lede: "Полный каталог французского Aroma-Zone с переводом на русский — но не склад: мы выкупаем товар во Франции только после того, как вы оплатили заказ. Это гарантирует свежесть партии и настоящую цену производителя.",
  blocks: [
    { title: "Полный каталог Aroma-Zone", body: "Ассортимент — как на официальном сайте в Париже, переводим карточки на русский." },
    { title: "Выкуп после оплаты", body: "Ничего не лежит на складе месяцами — заказ уходит во Францию только под уже оплаченный цикл." },
    { title: "Доставка из Франции — бесплатно", body: "Вы оплачиваете только пересылку из Омска до вашего города, не международную доставку." },
  ],
  note: "аромазон-тут — независимый сервис совместных закупок, официальным магазином или представительством Aroma-Zone (Франция) не является.",
};

export default async function AboutPage() {
  const content =
    (await apiGet<{
      eyebrow: string;
      title: string;
      lede: string;
      blocks: { title: string; body: string }[];
      note?: string;
    }>("/pages/about")) ?? FALLBACK;

  return (
    <PageTransition>
      <main className={styles.page}>
        <div>
          <span className={styles.eyebrow}>{content.eyebrow}</span>
          <h1 className={styles.title}>{content.title}</h1>
        </div>
        <p className={styles.lede}>{content.lede}</p>
        <ul className={styles.list}>
          {content.blocks.map((block, i) => (
            <li key={i}>
              <b>{block.title}</b>
              {block.body}
            </li>
          ))}
        </ul>
        {content.note && <p className={styles.fineNote}>{content.note}</p>}
      </main>
    </PageTransition>
  );
}
