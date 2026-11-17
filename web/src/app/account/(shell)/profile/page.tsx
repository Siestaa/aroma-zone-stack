import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api/server";
import { PageTransition } from "@/components/transitions/PageTransition";
import type { AuthUser } from "@/lib/api/types";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const res = await apiFetch("/auth/me");
  if (res.status === 401) redirect("/account");
  if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
  const user = (await res.json()) as AuthUser;

  return (
    <PageTransition>
      <ProfileForm user={user} />
    </PageTransition>
  );
}
