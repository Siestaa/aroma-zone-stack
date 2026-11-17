"use client";

import { Accordion } from "radix-ui";
import styles from "./Accordion.module.css";

export function ProductAccordion({
  items,
}: {
  items: { value: string; title: string; content: string }[];
}) {
  return (
    <Accordion.Root className={styles.root} type="single" collapsible defaultValue={items[0]?.value}>
      {items.map((item) => (
        <Accordion.Item key={item.value} value={item.value} className={styles.item}>
          <Accordion.Header>
            <Accordion.Trigger className={styles.trigger}>
              {item.title}
              <span className={styles.chevron}>▾</span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className={styles.contentWrap}>
            <p className={styles.content}>{item.content}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
