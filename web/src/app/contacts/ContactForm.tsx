"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { contactSchema, type ContactFormValues } from "./schema";
import styles from "./page.module.css";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema) });

  async function onSubmit() {
    await new Promise((resolve) => setTimeout(resolve, 400));
    setSent(true);
  }

  if (sent) {
    return (
      <div className={styles.success}>
        Спасибо! Мы ответим на указанный email в течение одного-двух рабочих дней.
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="Имя" placeholder="Как к вам обращаться" error={errors.name?.message} {...register("name")} />
      <Field
        label="Email"
        type="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <Field
        as="textarea"
        label="Сообщение"
        placeholder="Опишите вопрос"
        error={errors.message?.message}
        {...register("message")}
      />
      <Button type="submit" disabled={isSubmitting} style={{ alignSelf: "flex-start" }}>
        {isSubmitting ? "Отправляем…" : "Отправить"}
      </Button>
    </form>
  );
}
