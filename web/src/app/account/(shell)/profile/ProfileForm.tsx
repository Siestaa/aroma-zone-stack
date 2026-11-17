"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useUpdateProfileMutation } from "@/lib/redux/authApi";
import type { AuthUser } from "@/lib/api/types";
import { profileSchema, type ProfileFormValues } from "./schema";
import styles from "./ProfileForm.module.css";

export function ProfileForm({ user }: { user: AuthUser }) {
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, phone: user.phone ?? "" },
  });

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  async function onSubmit(values: ProfileFormValues) {
    setError(null);
    setSaved(false);
    try {
      await updateProfile({ name: values.name, phone: values.phone || null }).unwrap();
      setSaved(true);
    } catch {
      setError("Не получилось сохранить изменения. Попробуйте ещё раз.");
    }
  }

  return (
    <div>
      <h1 className={styles.title}>Личные данные</h1>
      <form className={styles.stack} onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Email" type="email" value={user.email} disabled note="Используется для входа, изменить нельзя" />
        <Field label="Имя" placeholder="Как к вам обращаться" error={errors.name?.message} {...register("name")} />
        <Field
          label="Телефон"
          type="tel"
          placeholder="+7 900 000-00-00"
          note="На этот номер вернём переплату, если сумма изменится по курсу на день выкупа"
          error={errors.phone?.message}
          {...register("phone")}
        />
        {error && <span className={styles.error}>{error}</span>}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Сохраняем…" : saved ? "Сохранено ✓" : "Сохранить"}
        </Button>
      </form>
    </div>
  );
}
