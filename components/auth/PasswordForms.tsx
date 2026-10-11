"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { authCallbackUrl } from "@/lib/env"
import { authErrorMessage } from "@/lib/auth/messages"
import { AuthAlert, AuthShell } from "./AuthShell"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const parsed = z.string().trim().toLowerCase().email().safeParse(email)
    if (!parsed.success) {
      setError("Enter a valid email address")
      return
    }
    setLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: authCallbackUrl("/update-password"),
    })
    setLoading(false)
    // Rate-limit errors are worth showing; anything else stays generic to avoid account enumeration.
    if (resetError && resetError.status === 429) {
      setError(authErrorMessage(resetError))
      return
    }
    setSent(true)
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <AuthAlert tone="success">If an account exists for that email, a reset link is on its way.</AuthAlert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {error && <AuthAlert tone="error">{error}</AuthAlert>}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72)
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/\d/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] })

export function UpdatePasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const parsed = newPasswordSchema.safeParse({ password, confirm })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid password")
      return
    }
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password })
    setLoading(false)
    if (updateError) {
      setError(authErrorMessage(updateError))
      return
    }
    toast.success("Password updated")
    router.replace("/dashboard")
    router.refresh()
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
