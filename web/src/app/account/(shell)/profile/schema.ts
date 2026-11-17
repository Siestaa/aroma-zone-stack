import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(2, "Введите имя"),
  phone: z.string().min(10, "Введите номер телефона").or(z.literal("")),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
