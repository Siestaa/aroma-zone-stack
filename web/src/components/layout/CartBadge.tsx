"use client";

import { useAppSelector } from "@/lib/redux/hooks";
import { selectCartCount } from "@/lib/redux/cartSlice";
import styles from "./SiteHeader.module.css";

export function CartBadge() {
  const count = useAppSelector(selectCartCount);
  if (count === 0) return null;
  return <span className={styles.badge}>{count}</span>;
}
