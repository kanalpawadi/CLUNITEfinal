import type { AuthError } from "@supabase/supabase-js"

/** Maps Supabase auth errors to clear, non-enumerating messages. */
export function authErrorMessage(error: AuthError | Error | null | undefined): string {
  if (!error) return ""
  const code = "code" in error ? (error.code as string | undefined) : undefined
  const msg = error.message.toLowerCase()

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "Email or password is incorrect."
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Please verify your email first. We can resend the link."
  }
  if (code === "user_already_exists" || msg.includes("already registered")) {
    return "An account with this email already exists. Try signing in."
  }
  if (code === "weak_password" || msg.includes("password should")) {
    return "Choose a stronger password (at least 8 characters, mixing letters and numbers)."
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || msg.includes("rate limit")) {
    return "Too many attempts. Please wait a minute and try again."
  }
  if (code === "otp_expired" || msg.includes("expired")) {
    return "That link has expired. Please request a new one."
  }
  if (msg.includes("fetch") || msg.includes("network")) {
    return "Can't reach the server. Check your connection and try again."
  }
  return error.message || "Something went wrong. Please try again."
}

export const reasonMessages: Record<string, string> = {
  session_expired: "Your session expired. Please sign in again.",
  auth_required: "Please sign in to continue.",
}
