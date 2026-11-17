"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useUpdateProfileMutation } from "@/lib/redux/authApi";
import type { AuthUser } from "@/lib/api/types";
import { addressSchema, type AddressFormValues } from "./schema";
import styles from "./AddressForm.module.css";

export function AddressForm({ user }: { user: AuthUser }) {
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [hasSaved, setHasSaved] = useState(Boolean(user.city && user.address));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { city: user.city ?? "", address: user.address ?? "" },
  });

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  async function onSubmit(values: AddressFormValues) {
    setError(null);
    setSaved(false);
    try {
      await updateProfile(values).unwrap();
      setHasSaved(true);
      setSaved(true);
    } catch {
      setError("Не получилось сохранить адрес. Попробуйте ещё раз.");
    }
  }

  async function onDelete() {
    setError(null);
    setSaved(false);
    try {
      await updateProfile({ city: null, address: null }).unwrap();
      reset({ city: "", address: "" });
      setHasSaved(false);
    } catch {
      setError("Не получилось удалить адрес. Попробуйте ещё раз.");
    }
  }

  return (
    <div>
      <h1 className={styles.title}>Адрес доставки</h1>
      <p className={styles.sub}>
        Один сохранённый адрес на аккаунт — подставится в форму заказа, когда вы выберете доставку
        Почтой России.
      </p>
      <form className={styles.stack} onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Город" placeholder="Город" error={errors.city?.message} {...register("city")} />
        <Field
          label="Индекс и адрес"
          placeholder="Почтовый индекс, улица, дом"
          error={errors.address?.message}
          {...register("address")}
        />
        {error && <span className={styles.error}>{error}</span>}
        <div className={styles.actions}>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Сохраняем…" : saved ? "Сохранено ✓" : "Сохранить"}
          </Button>
          {hasSaved && (
            <Button type="button" variant="outline" disabled={isLoading} onClick={onDelete}>
              Удалить адрес
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
