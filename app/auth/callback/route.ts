import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { safeRedirectPath } from "@/lib/auth/redirect"

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"]

/**
 * Completes every email/OAuth auth flow:
 *  - `?code=`                   PKCE (OAuth, magic link, signup confirmation, recovery)
 *  - `?token_hash=&type=`       email template links using the token-hash format
 * then redirects to the sanitised `next` (or `redirectTo`) path.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get("code")
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type")
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error")
  const next = safeRedirectPath(url.searchParams.get("next") ?? url.searchParams.get("redirectTo"))

  const fail = (message: string) => {
    const target = new URL("/login", url.origin)
    target.searchParams.set("error", message)
    if (next !== "/dashboard") target.searchParams.set("redirectTo", next)
    return NextResponse.redirect(target)
  }

  if (providerError) return fail(providerError)

  const supabase = createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return fail("That sign-in link is invalid or has expired. Please try again.")
  } else if (tokenHash && type && (OTP_TYPES as readonly string[]).includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })
    if (error) return fail("That link is invalid or has expired. Please request a new one.")
  } else {
    return fail("Missing sign-in code.")
  }

  const destination = type === "recovery" ? "/update-password" : next
  return NextResponse.redirect(new URL(destination, url.origin))
}
