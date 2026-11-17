"use client";

import { Checkbox as RadixCheckbox } from "radix-ui";
import styles from "./Checkbox.module.css";

export function Checkbox({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className={`${styles.opt} tap-target`}>
      <RadixCheckbox.Root
        className={styles.box}
        checked={checked}
        onCheckedChange={(state) => onCheckedChange(state === true)}
      >
        <RadixCheckbox.Indicator className={styles.indicator}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l2.5 2.5L10 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      {label}
    </label>
  );
}
