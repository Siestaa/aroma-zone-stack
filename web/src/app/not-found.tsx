import Image from "next/image";
import { Button } from "@/components/ui/Button";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.wrap}>
      {/* The heading and subtitle ("Страница не найдена" / "Похоже, этот
          аромат уже выветрился…") are baked into the illustration itself —
          alt carries that same copy for screen readers instead of
          duplicating it as visible text underneath. */}
      <Image
        src="/404-illustration.png"
        alt="Ошибка 404 — страница не найдена. Похоже, этот аромат уже выветрился…"
        width={1536}
        height={1024}
        priority
        className={styles.illustration}
      />
      <Button href="/">На главную</Button>
    </main>
  );
}
