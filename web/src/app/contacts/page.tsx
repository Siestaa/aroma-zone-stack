import { apiGet } from "@/lib/api/server";
import { pageMetadata } from "@/lib/seo";
import { PageTransition } from "@/components/transitions/PageTransition";
import { ContactForm } from "./ContactForm";
import styles from "./page.module.css";

export const metadata = pageMetadata(
  "/contacts", "Контакты",
  "Свяжитесь с организаторами совместных закупок Aroma-Zone, чтобы уточнить условия заказа, оплаты и доставки.",
);

// Original hardcoded copy — used only if /api/pages/contacts itself fails.
const FALLBACK = {
  email: "aromazone.tut@gmail.com",
  communityText: "Актуальные остатки, трек-номера и фотоотчёты закупок — в",
  communityLinkText: "группе ВКонтакте",
  communityLinkUrl: "https://vk.com/natural_organic_products",
};

export default async function ContactsPage() {
  const content =
    (await apiGet<{
      email: string;
      communityText: string;
      communityLinkText: string;
      communityLinkUrl: string;
    }>("/pages/contacts")) ?? FALLBACK;

  return (
    <PageTransition>
      <main>
        <h1 className={styles.title}>Контакты</h1>
        <div className={styles.layout}>
          <div>
            <dl className={styles.dl}>
              <dt>Email</dt>
              <dd className="mono">{content.email}</dd>
            </dl>
            <div className={styles.communityCard}>
              {content.communityText}{" "}
              <a href={content.communityLinkUrl} target="_blank" rel="noopener noreferrer">
                {content.communityLinkText}
              </a>
              .
            </div>
          </div>
          <ContactForm />
        </div>
      </main>
    </PageTransition>
  );
}
