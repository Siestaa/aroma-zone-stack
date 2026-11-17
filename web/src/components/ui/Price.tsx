import { formatApproxRub, formatEurCents } from "@/lib/format";
import styles from "./Price.module.css";

export function Price({
  eurCents,
  oldEurCents,
  approxRub,
  size,
}: {
  eurCents: number;
  oldEurCents?: number;
  approxRub: number;
  size?: "sm" | "lg";
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.row} style={size === "lg" ? { fontSize: 22 } : undefined}>
        <span className={styles.price}>{formatEurCents(eurCents)}</span>
        {oldEurCents && <span className={styles.old}>{formatEurCents(oldEurCents)}</span>}
      </div>
      <span className={styles.approx}>{formatApproxRub(approxRub)}*</span>
    </div>
  );
}
