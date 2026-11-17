import { api } from "@/lib/redux/api";
import type { ProductListItem, ProductsResponse } from "@/lib/api/types";

const MAX_RESULTS = 8;

const searchApi = api.injectEndpoints({
  endpoints: (builder) => ({
    searchProducts: builder.query<ProductListItem[], string>({
      query: (q) => `/products?q=${encodeURIComponent(q)}`,
      transformResponse: (response: ProductsResponse) => response.products.slice(0, MAX_RESULTS),
    }),
  }),
});

export const { useSearchProductsQuery } = searchApi;
