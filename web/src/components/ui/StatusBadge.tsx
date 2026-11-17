import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/api/types";
import styles from "./StatusBadge.module.css";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`${styles.status} ${styles[status]}`}>{ORDER_STATUS_LABEL[status]}</span>;
}
