import { apiGet } from "@/lib/api/server";
import { pageMetadata } from "@/lib/seo";
import { PageTransition } from "@/components/transitions/PageTransition";
import styles from "@/app/_shared/InfoPage.module.css";

export const metadata = pageMetadata(
  "/delivery", "Доставка заказов Aroma-Zone",
  "Как получить заказ Aroma-Zone после выкупа во Франции. Условия отправки из Омска и получения заказа.",
);

// Original hardcoded copy — used only if /api/pages/delivery itself fails.
const FALLBACK = {
  eyebrow: "Доставка",
  title: "Как забрать заказ после выкупа",
  lede: "После закрытия цикла и выкупа во Франции посылка идёт 10–14 дней (зависит от таможни и почты), фотографируется и разбирается по заказам в Омске.",
  blocks: [
    {
      title: "СДЭК",
      body: "Отправляем в ближайший к вам пункт выдачи или курьером. Стоимость доставки не входит в предоплату заказа — оплачивается отдельно, курьеру или в пункте выдачи, при получении.",
    },
    {
      title: "Невостребованные посылки",
      body: "Если посылка не забрана в течение 30 дней и вернулась к нам не по нашей вине — стоимость заказа не возвращается.",
    },
  ],
};

export default async function DeliveryPage() {
  const content =
    (await apiGet<{
      eyebrow: string;
      title: string;
      lede: string;
      blocks: { title: string; body: string }[];
    }>("/pages/delivery")) ?? FALLBACK;

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
