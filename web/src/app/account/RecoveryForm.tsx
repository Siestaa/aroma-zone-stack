"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useForgotPasswordMutation, useResetPasswordMutation } from "@/lib/redux/authApi";
import styles from "./page.module.css";

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function readToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
}

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const token = useSyncExternalStore(subscribeToHash, readToken, () => "");
  const [forgotPassword, { isLoading: requesting }] = useForgotPasswordMutation();
  const [resetPassword, { isLoading: saving }] = useResetPasswordMutation();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      if (reset) {
        await resetPassword({ token, password: String(fields.get("password")) }).unwrap();
        setMessage("Пароль изменён. Войдите с новым паролем.");
      } else {
        const result = await forgotPassword({ email: String(fields.get("email")).trim() }).unwrap();
        setMessage(result.message);
      }
    } catch (err) {
      setError((err as { data?: { error?: string } }).data?.error ?? "Не удалось выполнить запрос. Попробуйте ещё раз.");
    }
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 id="recovery-title">{reset ? "Новый пароль" : "Восстановление пароля"}</h1>
        <p className={styles.sub}>{reset ? "Задайте пароль от 8 до 128 символов." : "Введите email, который использовали при регистрации."}</p>
        {message ? <p role="status">{message}</p> : (
          <form method="post" aria-labelledby="recovery-title" className={styles.stack} onSubmit={submit}>
            {reset ? (
              <>
                <Field label="Новый пароль" name="password" type={showPassword ? "text" : "password"}
                  autoComplete="new-password" required minLength={8} maxLength={128} />
                <button className={styles.recoveryLink} type="button" aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}>Показать пароль</button>
                {!token && <p role="status">Откройте ссылку из письма или запросите новую.</p>}
              </>
            ) : (
              <Field label="Email" name="email" type="email" autoComplete="username" spellCheck={false} required maxLength={254} />
            )}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <Button type="submit" block disabled={requesting || saving || (reset && !token)}>
              {requesting || saving ? "Отправляем…" : reset ? "Сохранить пароль" : "Получить ссылку"}
            </Button>
          </form>
        )}
        {reset && !message && <Link href="/account/forgot-password" className={styles.recoveryLink}>Запросить новую ссылку</Link>}
        <Link href="/account" className={styles.recoveryLink}>Вернуться ко входу</Link>
      </div>
    </main>
  );
}
