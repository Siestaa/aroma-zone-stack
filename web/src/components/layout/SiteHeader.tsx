import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { CartBadge } from "./CartBadge";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header} style={{ viewTransitionName: "site-header" }}>
      <div className={styles.inner}>
        <Link href="/" className={styles.wordmark} transitionTypes={["nav-back"]}>
          <img
            src="/header-logo.png"
            alt="аромазон-тут"
            className={`${styles.wordmarkImg} ${styles.wordmarkImgLight}`}
          />
          <img
            src="/header-logo-dark.png"
            alt="аромазон-тут"
            className={`${styles.wordmarkImg} ${styles.wordmarkImgDark}`}
          />
        </Link>
        <nav className={styles.nav}>
          <Link href="/catalog" className="tap-target" transitionTypes={["nav-back"]}>
            Каталог
          </Link>
          <Link href="/about" className="tap-target" transitionTypes={["nav-back"]}>
            О нас
          </Link>
          <Link href="/contacts" className="tap-target" transitionTypes={["nav-back"]}>
            Контакты
          </Link>
        </nav>
        <div className={styles.icons}>
          <ThemeToggle />
          <Link href="/account/favorites" className="tap-target" transitionTypes={["nav-back"]}>
            Избранное
          </Link>
          <Link href="/account" className="tap-target" transitionTypes={["nav-back"]}>
            Профиль
          </Link>
          <Link href="/cart" className="tap-target" transitionTypes={["nav-back"]}>
            Корзина
            <CartBadge />
          </Link>
        </div>
        <div className={styles.mobileBar}>
          {/* Every nav link now lives in <MobileTabBar> or the footer — the
              header's mobile bar is just the theme toggle. */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
