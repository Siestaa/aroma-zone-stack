import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Введите имя").max(100, "Максимум 100 символов"),
  email: z.email("Некорректный email").max(254),
  message: z.string().trim().min(10, "Опишите вопрос чуть подробнее").max(5000, "Максимум 5000 символов"),
});

export type ContactFormValues = z.infer<typeof contactSchema>;
