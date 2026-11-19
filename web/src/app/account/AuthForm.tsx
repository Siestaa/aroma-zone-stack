"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/ui/Field";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/transitions/PageTransition";
import { useLoginMutation, useRegisterMutation } from "@/lib/redux/authApi";
import { AuthModeToggle, type AuthMode } from "./AuthModeToggle";
import { loginSchema, registerSchema, type LoginFormValues, type RegisterFormValues } from "./schema";
import styles from "./page.module.css";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [login, { isLoading: loggingIn }] = useLoginMutation();
  const [registerUser, { isLoading: registering }] = useRegisterMutation();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: false },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  async function onLogin(values: LoginFormValues) {
    setLoginError(null);
    try {
      await login({ email: values.email, password: values.password }).unwrap();
      router.push("/account/orders");
      router.refresh();
    } catch (err) {
      const message = (err as { data?: { error?: string } })?.data?.error;
      setLoginError(message ?? "Не получилось войти");
    }
  }

  async function onRegister(values: RegisterFormValues) {
    setRegisterError(null);
    try {
      await registerUser({
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
      }).unwrap();
      router.push("/account/orders");
      router.refresh();
    } catch (err) {
      const message = (err as { data?: { error?: string } })?.data?.error;
      setRegisterError(message ?? "Не получилось зарегистрироваться");
    }
  }

  return (
    <PageTransition>
      <main className={styles.wrap}>
        <AuthModeToggle value={mode} onValueChange={setMode} />

        <div className={styles.card}>
          {mode === "login" ? (
            <>
              <h2>Уже с нами</h2>
              <p className={styles.sub}>Войдите, чтобы видеть заказы и их статус</p>
              <form className={styles.stack} onSubmit={loginForm.handleSubmit(onLogin)} noValidate>
                <Field
                  label="Email"
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  required
                  placeholder="you@example.com"
                  error={loginForm.formState.errors.email?.message}
                  {...loginForm.register("email")}
                />
                <Field
                  label="Пароль"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  error={loginForm.formState.errors.password?.message}
                  {...loginForm.register("password")}
                />
                <Controller
                  name="remember"
                  control={loginForm.control}
                  render={({ field }) => (
                    <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} label="Запомнить меня" />
                  )}
                />
                <Link href="/account/forgot-password" className={styles.recoveryLink}>Забыли пароль?</Link>
                {loginError && <span className={styles.error}>{loginError}</span>}
                <Button type="submit" block disabled={loggingIn}>
                  {loggingIn ? "Входим…" : "Войти"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2>Впервые у нас</h2>
              <p className={styles.sub}>Регистрация нужна, чтобы оформлять заказы и отслеживать их статус</p>
              <form className={styles.stack} onSubmit={registerForm.handleSubmit(onRegister)} noValidate>
                <Field
                  label="Имя"
                  placeholder="Как к вам обращаться"
                  error={registerForm.formState.errors.name?.message}
                  {...registerForm.register("name")}
                />
                <Field
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  error={registerForm.formState.errors.email?.message}
                  {...registerForm.register("email")}
                />
                <Field
                  label="Телефон"
                  type="tel"
                  placeholder="+7 900 000-00-00"
                  note="На этот номер вернём переплату, если сумма изменится по курсу на день выкупа"
                  error={registerForm.formState.errors.phone?.message}
                  {...registerForm.register("phone")}
                />
                <Field
                  label="Пароль"
                  type="password"
                  placeholder="Минимум 8 символов"
                  error={registerForm.formState.errors.password?.message}
                  {...registerForm.register("password")}
                />
                <Field
                  label="Повторите пароль"
                  type="password"
                  placeholder="••••••••"
                  error={registerForm.formState.errors.confirmPassword?.message}
                  {...registerForm.register("confirmPassword")}
                />
                <div>
                  <Controller
                    name="agree"
                    control={registerForm.control}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        label="Согласен с условиями участия в совместных закупках"
                      />
                    )}
                  />
                  {registerForm.formState.errors.agree && (
                    <span className={styles.error}>{registerForm.formState.errors.agree.message}</span>
                  )}
                </div>
                {registerError && <span className={styles.error}>{registerError}</span>}
                <Button type="submit" block disabled={registering}>
                  {registering ? "Регистрируем…" : "Зарегистрироваться"}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </PageTransition>
  );
}
