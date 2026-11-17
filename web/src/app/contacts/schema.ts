import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(2, "Введите имя"),
  email: z.email("Некорректный email"),
  message: z.string().min(10, "Опишите вопрос чуть подробнее"),
});

export type ContactFormValues = z.infer<typeof contactSchema>;
