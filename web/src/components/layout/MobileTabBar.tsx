"use client";

import { useDeferredValue } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppSelector } from "@/lib/redux/hooks";
import { selectCartCount } from "@/lib/redux/cartSlice";
import { useMeQuery } from "@/lib/redux/authApi";
import { useGetFavoritesQuery } from "@/lib/redux/favoritesApi";
import styles from "./MobileTabBar.module.css";

const TABS = [
  {
    href: "/",
    label: "Главная",
    isActive: (path: string) => path === "/",
    icon: (
      <path d="M4 11.5 12 4l8 7.5M6 9.5V20h5v-6h2v6h5V9.5" />
    ),
  },
  {
    href: "/catalog",
    label: "Каталог",
    isActive: (path: string) => path.startsWith("/catalog") || path.startsWith("/product"),
    icon: (
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
    ),
  },
  {
    href: "/account/favorites",
    label: "Избранное",
    isActive: (path: string) => path.startsWith("/account/favorites"),
    icon: (
      <path d="M12 20s-7.5-4.6-9.7-9.2C.8 7.4 2.5 4 6 4c2 0 3.4 1.1 4 2.3C10.6 5.1 12 4 14 4c3.5 0 5.2 3.4 3.7 6.8C19.5 15.4 12 20 12 20Z" />
    ),
  },
  {
    href: "/cart",
    label: "Корзина",
    isActive: (path: string) => path.startsWith("/cart") || path.startsWith("/checkout"),
    icon: (
      <>
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
      </>
    ),
  },
  {
    href: "/account",
    label: "Профиль",
    isActive: (path: string) => path.startsWith("/account") && !path.startsWith("/account/favorites"),
    icon: (
      <>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M4.5 20c1.3-3.7 4.3-5.6 7.5-5.6s6.2 1.9 7.5 5.6" />
      </>
    ),
  },
] as const;

// Bottom app-shell tab bar, mobile only (see SiteHeader's matching ≤767px
// breakpoint). Replaces the header's old cart icon + hamburger's
// Избранное/Профиль links — those now live here so the primary sections are
// always one tap away, like a native app's tab bar.
export function MobileTabBar() {
  const pathname = usePathname();
  // Deliberately not used directly — a navigation's DOM mutation and this
  // bar's active-tab highlight change would then land in the exact same
  // paint as the page transition's snapshot capture, giving the browser a
  // real pixel diff to animate between (see the pinning rule in
  // globals.css) and causing a visible jump/flicker. useDeferredValue lets
  // the navigation itself render at full priority while this low-priority
  // value catches up a beat later, so the bar's rendered output stays
  // identical throughout the transition — nothing to snap between.
  const activePath = useDeferredValue(pathname);

  const cartCount = useAppSelector(selectCartCount);
  const { data: user } = useMeQuery();
  const { data: favorites } = useGetFavoritesQuery(undefined, { skip: !user });
  const favoritesCount = favorites?.length ?? 0;

  return (
    <nav className={styles.bar} aria-label="Основная навигация" style={{ viewTransitionName: "mobile-tab-bar" }}>
      {TABS.map((tab) => {
        const active = tab.isActive(activePath);
        const count = tab.href === "/cart" ? cartCount : tab.href === "/account/favorites" ? favoritesCount : 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={styles.tab}
            data-active={active}
            transitionTypes={["nav-back"]}
          >
            <span className={styles.iconWrap}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {tab.icon}
              </svg>
              {count > 0 && <span className={styles.badge}>{count}</span>}
            </span>
            <span className={styles.label}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
