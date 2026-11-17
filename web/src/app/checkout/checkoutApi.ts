import { api } from "@/lib/redux/api";
import type { Fulfillment, Order } from "@/lib/api/types";

export interface CreateOrderPayload {
  items: { productVariantId: string; qty: number }[];
  fulfillment: Fulfillment;
  city?: string;
  address?: string;
  comment?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

const checkoutApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createOrder: builder.mutation<Order, CreateOrderPayload>({
      query: (body) => ({ url: "/orders", method: "POST", body }),
    }),
  }),
});

export const { useCreateOrderMutation } = checkoutApi;
