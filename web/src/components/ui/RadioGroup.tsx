"use client";

import { RadioGroup as RadixRadioGroup } from "radix-ui";
import styles from "./RadioGroup.module.css";

export interface RadioOption {
  value: string;
  title: string;
  note: string;
}

export function RadioGroup({
  value,
  onValueChange,
  options,
  name,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: RadioOption[];
  name?: string;
}) {
  return (
    <RadixRadioGroup.Root
      className={styles.root}
      value={value}
      onValueChange={onValueChange}
      name={name}
    >
      {options.map((opt) => (
        <RadixRadioGroup.Item key={opt.value} value={opt.value} className={styles.item}>
          <span className={styles.dot}>
            <RadixRadioGroup.Indicator className={styles.indicator} />
          </span>
          <span className={styles.text}>
            <b>{opt.title}</b>
            <span className={styles.note}>{opt.note}</span>
          </span>
        </RadixRadioGroup.Item>
      ))}
    </RadixRadioGroup.Root>
  );
}
