import { z } from "zod";

// No `delivery` field — self-pickup and Почта России were both retired,
// every order ships via CDEK now (hardcoded in CheckoutForm's onSubmit), so
// there's no method to choose and the address is always required.
export const checkoutSchema = z.object({
  name: z.string().min(2, "Введите имя"),
  email: z.email("Некорректный email"),
  phone: z.string().min(10, "Введите номер телефона"),
  city: z.string().min(1, "Укажите город"),
  address: z.string().min(1, "Укажите адрес пункта выдачи СДЭК"),
  comment: z.string().optional(),
  agreedToTerms: z.literal(true, "Нужно подтвердить, что вы ознакомлены с условиями покупки"),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
