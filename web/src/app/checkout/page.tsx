import Link from "next/link";
import { PageTransition } from "@/components/transitions/PageTransition";
import { CheckoutForm } from "./CheckoutForm";
import styles from "./page.module.css";

export default function CheckoutPage() {
  return (
    <PageTransition>
      <main>
        <div className={styles.crumbs}>
          <Link href="/" transitionTypes={["nav-back"]}>
            Главная
          </Link>{" "}
          /{" "}
          <Link href="/cart" transitionTypes={["nav-back"]}>
            Корзина
          </Link>{" "}
          / Оформление заказа
        </div>
        <CheckoutForm />
      </main>
    </PageTransition>
  );
}
