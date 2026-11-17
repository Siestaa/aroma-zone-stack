import styles from "./Tag.module.css";

// Only "bio" and "outOfStock" have real backing data (Aroma-Zone's
// attributes.culture certification field, and a variant's own stock flag) —
// "new"/"sale" existed in the old mock but there's no equivalent real signal
// yet, so they're not offered here.
const LABEL: Record<"bio" | "outOfStock", string> = {
  bio: "био",
  outOfStock: "нет в наличии",
};

export function Tag({ tag, className }: { tag: "bio" | "outOfStock"; className?: string }) {
  return <span className={`${styles.tag} ${styles[tag]} ${className ?? ""}`}>{LABEL[tag]}</span>;
}
