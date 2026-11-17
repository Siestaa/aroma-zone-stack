import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useInvalidateAdminMe } from "./useAdminMe";
import { ThemeToggle } from "../theme/ThemeToggle";
import styles from "./LoginPage.module.css";

type Step =
  | { kind: "password" }
  | { kind: "totp-setup"; pendingToken: string; qrDataUrl: string }
  | { kind: "totp-verify"; pendingToken: string };

interface LoginResponse {
  step: "totp-setup" | "totp-verify" | "done";
  pendingToken: string;
  qrDataUrl?: string;
}

export function LoginPage() {
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const invalidateMe = useInvalidateAdminMe();
  const navigate = useNavigate();

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<LoginResponse>("/auth/login", { email, password });
      if (res.step === "done") {
        // ADMIN_DISABLE_2FA dev bypass (api/src/routes/adminAuth.ts) — the
        // session cookie is already set, log straight in.
        invalidateMe();
        navigate("/orders", { replace: true });
      } else if (res.step === "totp-setup" && res.qrDataUrl) {
        setStep({ kind: "totp-setup", pendingToken: res.pendingToken, qrDataUrl: res.qrDataUrl });
      } else {
        setStep({ kind: "totp-verify", pendingToken: res.pendingToken });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка входа");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind === "password") return;
    setError(null);
    setSubmitting(true);
    try {
      const path = step.kind === "totp-setup" ? "/auth/setup-totp" : "/auth/verify-totp";
      await api.post(path, { pendingToken: step.pendingToken, code });
      invalidateMe();
      navigate("/orders", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка входа");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.themeToggleWrap}>
        <ThemeToggle />
      </div>
      <div className={styles.card}>
        {step.kind === "password" && (
          <form onSubmit={handlePasswordSubmit}>
            <h1 className={styles.title}>Вход в админку</h1>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className={styles.submit} disabled={submitting}>
              Войти
            </button>
          </form>
        )}

        {step.kind !== "password" && (
          <form onSubmit={handleCodeSubmit}>
            <h1 className={styles.title}>
              {step.kind === "totp-setup" ? "Настройка 2FA" : "Код из приложения"}
            </h1>
            {error && <div className={styles.error}>{error}</div>}
            {step.kind === "totp-setup" && (
              <>
                <p className={styles.hint}>
                  Отсканируйте QR-код в Google Authenticator / Яндекс.Ключ, затем введите код,
                  который приложение показывает.
                </p>
                <img src={step.qrDataUrl} alt="QR-код для 2FA" className={styles.qr} />
              </>
            )}
            <div className={styles.field}>
              <label htmlFor="code">Код из приложения</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <button type="submit" className={styles.submit} disabled={submitting || code.length !== 6}>
              Подтвердить
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
