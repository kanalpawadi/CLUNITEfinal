import type { Metadata } from "next"
import { ForgotPasswordForm } from "@/components/auth/PasswordForms"

export const metadata: Metadata = { title: "Reset password · Clunite" }

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
