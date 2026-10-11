"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { authCallbackUrl, authProviders } from "@/lib/env"
import { safeRedirectPath } from "@/lib/auth/redirect"
import { authErrorMessage } from "@/lib/auth/messages"
import { AuthAlert, AuthDivider, AuthShell } from "./AuthShell"
import { GoogleButton } from "./GoogleButton"

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Use at most 72 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/\d/, "Include at least one number"),
    confirm: z.string(),
    college: z.string().trim().max(200),
    gender: z.string().trim().max(50),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] })

type Fields = z.input<typeof signupSchema>
type FieldErrors = Partial<Record<keyof Fields, string>>

export function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = safeRedirectPath(params.get("redirectTo"))

  const [fields, setFields] = useState<Fields>({ fullName: "", email: "", password: "", confirm: "", college: "", gender: "" })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const parsed = signupSchema.safeParse(fields)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Fields] ??= issue.message
      setErrors(next)
      return
    }
    setErrors({})
    setError(null)
    setLoading(true)
    const v = parsed.data
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: authCallbackUrl(redirectTo),
        // Copied into public.users by the handle_new_user trigger
        data: { full_name: v.fullName, college: v.college || null, gender: v.gender || null },
      },
    })
    setLoading(false)
    if (signUpError) {
      setError(authErrorMessage(signUpError))
      return
    }
    if (data.session) {
      router.replace(redirectTo)
      router.refresh()
    } else {
      setSentTo(v.email)
    }
  }

  const resend = async () => {
    if (!sentTo) return
    setLoading(true)
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: sentTo,
      options: { emailRedirectTo: authCallbackUrl(redirectTo) },
    })
    setLoading(false)
    setError(resendError ? authErrorMessage(resendError) : null)
  }

  if (sentTo) {
    return (
      <AuthShell title="Verify your email" subtitle={`We sent a confirmation link to ${sentTo}.`}>
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <p className="text-sm text-muted-foreground">
          Click the link to activate your account. You&apos;ll come straight back here afterwards.
        </p>
        <Button variant="outline" className="mt-6 w-full" onClick={resend} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Resend email
        </Button>
      </AuthShell>
    )
  }

  const err = (key: keyof Fields) =>
    errors[key] ? (
      <p id={`${key}-error`} className="text-sm text-destructive">
        {errors[key]}
      </p>
    ) : null
  const a11y = (key: keyof Fields) => ({
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
  })

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join clubs, register for events and get your member ID."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={redirectTo === "/dashboard" ? "/login" : `/login?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      {authProviders.google && (
        <>
          <GoogleButton redirectTo={redirectTo} onError={setError} />
          <AuthDivider />
        </>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" autoComplete="name" value={fields.fullName} onChange={set("fullName")} {...a11y("fullName")} />
          {err("fullName")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" inputMode="email" value={fields.email} onChange={set("email")} {...a11y("email")} />
          {err("email")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" value={fields.password} onChange={set("password")} {...a11y("password")} />
            {err("password")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" autoComplete="new-password" value={fields.confirm} onChange={set("confirm")} {...a11y("confirm")} />
            {err("confirm")}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="college">
              College <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="college" autoComplete="organization" value={fields.college} onChange={set("college")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">
              Gender <span className="text-muted-foreground">(optional)</span>
            </Label>
            <select
              id="gender"
              value={fields.gender}
              onChange={set("gender")}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
