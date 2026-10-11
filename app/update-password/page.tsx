import type { Metadata } from "next"
import { UpdatePasswordForm } from "@/components/auth/PasswordForms"
import { requireAuthUser } from "@/lib/auth/server"

export const metadata: Metadata = { title: "New password · Clunite" }

export default async function UpdatePasswordPage() {
  await requireAuthUser("/update-password")
  return <UpdatePasswordForm />
}
