import { api } from "@/lib/redux/api";
import type { Order } from "@/lib/api/types";

// Records the customer's own "I sent the money" claim (see api's
// schema.ts's customerMarkedPaidAt comment) — no cache tag to invalidate,
// the orders list/detail pages are server-rendered and refetch fresh on
// the next navigation regardless.
const ordersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    markOrderPaid: builder.mutation<Order, string>({
      query: (orderId) => ({ url: `/orders/${orderId}/mark-paid`, method: "POST" }),
    }),
  }),
});

export const { useMarkOrderPaidMutation } = ordersApi;
