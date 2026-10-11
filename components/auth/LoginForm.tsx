"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { z } from "zod"
import { Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { authCallbackUrl, authProviders } from "@/lib/env"
import { safeRedirectPath } from "@/lib/auth/redirect"
import { authErrorMessage, reasonMessages } from "@/lib/auth/messages"
import { AuthAlert, AuthDivider, AuthShell } from "./AuthShell"
import { GoogleButton } from "./GoogleButton"

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address")
const passwordSchema = z.string().min(1, "Enter your password")

type Method = "password" | "magic"

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = safeRedirectPath(params.get("redirectTo"))
  const reason = params.get("reason")

  const [method, setMethod] = useState<Method>("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(params.get("error"))
  const [info, setInfo] = useState<string | null>(reason ? (reasonMessages[reason] ?? null) : null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const withRedirect = (path: string) =>
    redirectTo === "/dashboard" ? path : `${path}?redirectTo=${encodeURIComponent(redirectTo)}`

  const validate = (needPassword: boolean) => {
    const errs: typeof fieldErrors = {}
    const e = emailSchema.safeParse(email)
    if (!e.success) errs.email = e.error.issues[0]?.message
    if (needPassword) {
      const p = passwordSchema.safeParse(password)
      if (!p.success) errs.password = p.error.issues[0]?.message
    }
    setFieldErrors(errs)
    return e.success && Object.keys(errs).length === 0 ? e.data : null
  }

  const onPasswordSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const cleanEmail = validate(true)
    if (!cleanEmail) return
    setLoading(true)
    setError(null)
    setUnconfirmed(false)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
    if (signInError) {
      setLoading(false)
      setUnconfirmed(signInError.code === "email_not_confirmed")
      setError(authErrorMessage(signInError))
      return
    }
    router.replace(redirectTo)
    router.refresh()
  }

  const onMagicSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const cleanEmail = validate(false)
    if (!cleanEmail) return
    setLoading(true)
    setError(null)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { emailRedirectTo: authCallbackUrl(redirectTo), shouldCreateUser: true },
    })
    setLoading(false)
    if (otpError) {
      setError(authErrorMessage(otpError))
      return
    }
    setMagicSent(true)
  }

  const resendVerification = async () => {
    const cleanEmail = validate(false)
    if (!cleanEmail) return
    setLoading(true)
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
      options: { emailRedirectTo: authCallbackUrl(redirectTo) },
    })
    setLoading(false)
    if (resendError) setError(authErrorMessage(resendError))
    else {
      setError(null)
      setUnconfirmed(false)
      setInfo("Verification email sent. Check your inbox.")
    }
  }

  if (magicSent) {
    return (
      <AuthShell title="Check your inbox" subtitle={`We sent a sign-in link to ${email.trim().toLowerCase()}.`}>
        <p className="text-sm text-muted-foreground">
          Open the link on this device to finish signing in. It expires in an hour.
        </p>
        <Button variant="outline" className="mt-6 w-full" onClick={() => setMagicSent(false)}>
          Use a different method
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle={redirectTo !== "/dashboard" ? "Sign in to continue where you left off." : "Welcome back to Clunite."}
      footer={
        <>
          New here?{" "}
          <Link href={withRedirect("/signup")} className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {info && <AuthAlert tone="info">{info}</AuthAlert>}
      {error && (
        <AuthAlert tone="error">
          {error}
          {unconfirmed && (
            <button type="button" onClick={resendVerification} className="ml-1 font-medium underline underline-offset-4">
              Resend verification email
            </button>
          )}
        </AuthAlert>
      )}

      {authProviders.google && (
        <>
          <GoogleButton redirectTo={redirectTo} onError={setError} />
          <AuthDivider />
        </>
      )}

      {authProviders.magicLink && (
        <div role="tablist" aria-label="Sign-in method" className="mb-5 grid grid-cols-2 rounded-lg border border-border bg-muted p-1 text-sm">
          {(["password", "magic"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={method === m}
              onClick={() => {
                setMethod(m)
                setError(null)
              }}
              className={`rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                method === m ? "bg-card font-medium text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "password" ? "Password" : "Email link"}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={method === "password" ? onPasswordSubmit : onMagicSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            required
          />
          {fieldErrors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {fieldErrors.email}
            </p>
          )}
        </div>

        {method === "password" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              required
            />
            {fieldErrors.password && (
              <p id="password-error" className="text-sm text-destructive">
                {fieldErrors.password}
              </p>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : method === "magic" && <Mail className="mr-2 h-4 w-4" aria-hidden />}
          {method === "password" ? "Sign in" : "Email me a sign-in link"}
        </Button>
      </form>
    </AuthShell>
  )
}
