import Link from "next/link";
import styles from "./Pagination.module.css";

type PageItem = number | "ellipsis";

function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push("ellipsis");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push("ellipsis");
  items.push(total);

  return items;
}

export function Pagination({
  currentPage,
  totalPages,
  buildHref,
}: {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const items = getPageItems(currentPage, totalPages);

  return (
    <nav className={styles.pagination} aria-label="Страницы каталога">
      {currentPage > 1 ? (
        <Link href={buildHref(currentPage - 1)} className={styles.pageLink} aria-label="Предыдущая страница">
          ‹
        </Link>
      ) : (
        <span className={styles.navDisabled} aria-hidden="true">
          ‹
        </span>
      )}

      {items.map((item, i) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>
            …
          </span>
        ) : (
          <Link
            key={item}
            href={buildHref(item)}
            className={`${styles.pageLink} ${item === currentPage ? styles.pageLinkActive : ""}`}
            aria-current={item === currentPage ? "page" : undefined}
          >
            {item}
          </Link>
        ),
      )}

      {currentPage < totalPages ? (
        <Link href={buildHref(currentPage + 1)} className={styles.pageLink} aria-label="Следующая страница">
          ›
        </Link>
      ) : (
        <span className={styles.navDisabled} aria-hidden="true">
          ›
        </span>
      )}
    </nav>
  );
}
