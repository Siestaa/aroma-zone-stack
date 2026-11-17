import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AdminMe } from "../lib/types";

export function useAdminMe() {
  return useQuery({
    queryKey: ["admin-me"],
    queryFn: () => api.get<AdminMe>("/auth/me"),
    // A 401 here just means "not logged in" — not a real error to retry or
    // surface, the query's `isError` state is exactly the signal ProtectedRoute
    // needs to redirect to /login.
    retry: false,
  });
}

export function useInvalidateAdminMe() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin-me"] });
}
