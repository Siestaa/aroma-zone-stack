import { api } from "./api";
import type { AuthUser } from "@/lib/api/types";

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// Partial on purpose — /account/profile sends {name, phone},
// /account/addresses sends {city, address}, each PATCH only touches what it sends.
export interface UpdateProfilePayload {
  name?: string;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
}

const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation<AuthUser, RegisterPayload>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
      invalidatesTags: ["User", "Cart", "Favorites"],
    }),
    login: builder.mutation<AuthUser, LoginPayload>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      invalidatesTags: ["User", "Cart", "Favorites"],
    }),
    logout: builder.mutation<{ ok: true }, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
      invalidatesTags: ["User", "Cart", "Favorites"],
      // Tag invalidation alone re-fetches `me`, but RTK Query keeps a
      // query's last-known `data` when a re-fetch errors (avoids UI flicker
      // on a transient failure) — so after logout, `me`'s 401 still left
      // `useMeQuery().data` holding the old user, and FavoriteButton (which
      // gates on that) kept firing real requests that 401'd silently
      // instead of redirecting to /account. A full reset drops the stale
      // cache entry instead of leaving it to error into staleness.
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        await queryFulfilled;
        dispatch(api.util.resetApiState());
      },
    }),
    me: builder.query<AuthUser, void>({
      query: () => "/auth/me",
      providesTags: ["User"],
    }),
    updateProfile: builder.mutation<AuthUser, UpdateProfilePayload>({
      query: (body) => ({ url: "/auth/me", method: "PATCH", body }),
      invalidatesTags: ["User"],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useUpdateProfileMutation,
} = authApi;
