import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api/server";
import { AuthForm } from "./AuthForm";

// This page is the login/register form — but only while logged out. Before
// this check existed, an already-authenticated user clicking "Профиль" in
// the header (which links here) would see the login form again even though
// their session was still perfectly valid, since AuthForm never checked
// auth state at all — it just unconditionally rendered the form. Every
// other /account/* page already does this same server-side session check
// (see orders/favorites/profile/addresses' page.tsx) and redirects the
// other direction (to /account on a 401); this is the missing symmetric case.
export default async function AccountPage() {
  const res = await apiFetch("/auth/me");
  if (res.ok) redirect("/account/orders");

  return <AuthForm />;
}
