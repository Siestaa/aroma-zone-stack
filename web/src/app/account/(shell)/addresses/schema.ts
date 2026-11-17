import { z } from "zod";

export const addressSchema = z.object({
  city: z.string().min(1, "Укажите город"),
  address: z.string().min(1, "Укажите почтовый индекс, улицу и дом"),
});

export type AddressFormValues = z.infer<typeof addressSchema>;
