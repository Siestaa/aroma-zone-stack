import { api } from "./api";
import type { CartLine, ServerCartItem } from "@/lib/api/types";

// Maps the server's cart_item row shape into our client CartLine shape —
// keeps `cartItemId` around so subsequent PATCH/DELETE calls can address it.
export function mapServerCartItems(items: ServerCartItem[]): CartLine[] {
  return items.map((i) => ({
    cartItemId: i.id,
    productVariantId: i.productVariantId,
    productSlug: i.productSlug,
    productName: i.productName,
    sku: i.sku,
    capacity: i.capacity,
    capacityUnit: i.capacityUnit,
    formatType: i.formatType,
    priceEurCents: i.priceEurCents,
    imageUrl: i.imageUrl,
    qty: i.qty,
  }));
}

const cartApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getServerCart: builder.query<ServerCartItem[], void>({
      query: () => "/cart",
      transformResponse: (r: { items: ServerCartItem[] }) => r.items,
      providesTags: ["Cart"],
    }),
    addServerCartItem: builder.mutation<ServerCartItem[], { productVariantId: string; qty: number }>({
      query: (body) => ({ url: "/cart/items", method: "POST", body }),
      transformResponse: (r: { items: ServerCartItem[] }) => r.items,
      invalidatesTags: ["Cart"],
    }),
    updateServerCartItemQty: builder.mutation<ServerCartItem[], { id: string; qty: number }>({
      query: ({ id, qty }) => ({ url: `/cart/items/${id}`, method: "PATCH", body: { qty } }),
      transformResponse: (r: { items: ServerCartItem[] }) => r.items,
      invalidatesTags: ["Cart"],
    }),
    removeServerCartItem: builder.mutation<ServerCartItem[], { id: string }>({
      query: ({ id }) => ({ url: `/cart/items/${id}`, method: "DELETE" }),
      transformResponse: (r: { items: ServerCartItem[] }) => r.items,
      invalidatesTags: ["Cart"],
    }),
    clearServerCart: builder.mutation<ServerCartItem[], void>({
      query: () => ({ url: "/cart", method: "DELETE" }),
      transformResponse: (r: { items: ServerCartItem[] }) => r.items,
      invalidatesTags: ["Cart"],
    }),
  }),
});

export const {
  useGetServerCartQuery,
  useLazyGetServerCartQuery,
  useAddServerCartItemMutation,
  useUpdateServerCartItemQtyMutation,
  useRemoveServerCartItemMutation,
  useClearServerCartMutation,
} = cartApi;
