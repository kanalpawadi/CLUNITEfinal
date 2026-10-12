/**
 * Route rules shared by middleware, server components and the login UI.
 * Kept free of server-only imports so client components can use it.
 */

export const DEFAULT_AFTER_LOGIN = "/dashboard"

/** Paths that require a signed-in user (prefix match unless noted). */
const PROTECTED_PATTERNS: RegExp[] = [
  /^\/dashboard(\/|$)/,
  /^\/profile(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/clubs\/[^/]+(\/|$)/, // /clubs (listing) stays public; club pages need an account
  /^\/events\/[^/]+\/register(\/|$)/,
  /^\/events\/[^/]+\/teams(\/|$)/, // team finder shows students' names: members only
  /^\/teams(\/|$)/,
  /^\/notifications(\/|$)/,
  /^\/payments(\/|$)/,
  /^\/update-password(\/|$)/,
]

/** Auth screens a signed-in user should be bounced away from. */
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"]

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATTERNS.some((re) => re.test(pathname))
}

export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY.includes(pathname)
}

/**
 * Returns `value` only if it is a same-origin relative path, else the fallback.
 * Blocks open redirects such as `//evil.com`, `/\evil.com` or `https://evil.com`.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN): string {
  if (!value) return fallback
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return fallback
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\\")) return fallback
  if (/[\u0000-\u001f]/.test(decoded)) return fallback
  if (isGuestOnlyPath(decoded.split("?")[0] ?? "")) return fallback
  return decoded
}

/** `/login?redirectTo=<path>` (path includes the query string). */
export function loginUrl(redirectTo: string, reason?: "session_expired" | "auth_required"): string {
  const params = new URLSearchParams({ redirectTo })
  if (reason) params.set("reason", reason)
  return `/login?${params.toString()}`
}
