"use client";

import { RadioGroup } from "radix-ui";
import styles from "./AuthModeToggle.module.css";

export type AuthMode = "login" | "register";

export function AuthModeToggle({ value, onValueChange }: { value: AuthMode; onValueChange: (value: AuthMode) => void }) {
  return (
    <RadioGroup.Root
      className={styles.root}
      value={value}
      onValueChange={(v) => onValueChange(v as AuthMode)}
    >
      <RadioGroup.Item value="login" className={styles.item}>
        Вход
      </RadioGroup.Item>
      <RadioGroup.Item value="register" className={styles.item}>
        Регистрация
      </RadioGroup.Item>
    </RadioGroup.Root>
  );
}
