import { api } from "./api";
import type { ProductListItem } from "@/lib/api/types";

const favoritesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFavorites: builder.query<ProductListItem[], void>({
      query: () => "/favorites",
      transformResponse: (r: { favorites: ProductListItem[] }) => r.favorites,
      providesTags: ["Favorites"],
    }),
    addFavorite: builder.mutation<ProductListItem[], string>({
      query: (productId) => ({ url: `/favorites/${productId}`, method: "POST" }),
      transformResponse: (r: { favorites: ProductListItem[] }) => r.favorites,
      invalidatesTags: ["Favorites"],
    }),
    removeFavorite: builder.mutation<ProductListItem[], string>({
      query: (productId) => ({ url: `/favorites/${productId}`, method: "DELETE" }),
      transformResponse: (r: { favorites: ProductListItem[] }) => r.favorites,
      invalidatesTags: ["Favorites"],
    }),
  }),
});

export const { useGetFavoritesQuery, useAddFavoriteMutation, useRemoveFavoriteMutation } = favoritesApi;
