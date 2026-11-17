import { Navigate, Outlet } from "react-router-dom";
import { useAdminMe } from "./useAdminMe";

export function ProtectedRoute() {
  const { data, isLoading, isError } = useAdminMe();

  if (isLoading) return null;
  if (isError || !data) return <Navigate to="/login" replace />;

  return <Outlet />;
}
