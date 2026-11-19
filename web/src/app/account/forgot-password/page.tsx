import type { Metadata } from "next";
import { RecoveryForm } from "../RecoveryForm";

export const metadata: Metadata = { title: "Восстановление пароля", robots: { index: false }, referrer: "no-referrer" };

export default function ForgotPasswordPage() {
  return <RecoveryForm />;
}
