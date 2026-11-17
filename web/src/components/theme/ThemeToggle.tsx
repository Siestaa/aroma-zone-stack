"use client";

import { useThemeToggle } from "./useThemeToggle";
import { ThemeIcon } from "./ThemeIcon";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle() {
  const { theme, toggle } = useThemeToggle();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`${styles.toggle} tap-target`}
      onClick={toggle}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      aria-pressed={isDark}
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}
