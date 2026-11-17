import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api/server";
import { PageTransition } from "@/components/transitions/PageTransition";
import type { AuthUser } from "@/lib/api/types";
import { AddressForm } from "./AddressForm";

export default async function AddressesPage() {
  const res = await apiFetch("/auth/me");
  if (res.status === 401) redirect("/account");
  if (!res.ok) throw new Error(`Failed to load address: ${res.status}`);
  const user = (await res.json()) as AuthUser;

  return (
    <PageTransition>
      <AddressForm user={user} />
    </PageTransition>
  );
}
