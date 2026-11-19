import type { Metadata } from "next";
import { RecoveryForm } from "../RecoveryForm";

export const metadata: Metadata = { title: "Новый пароль", robots: { index: false }, referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return <RecoveryForm reset />;
}
