import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database"
import { publicEnv } from "@/lib/env"
import { DEFAULT_AFTER_LOGIN, isGuestOnlyPath, isProtectedPath, loginUrl, safeRedirectPath } from "@/lib/auth/redirect"

/**
 * Refreshes the Supabase session cookie on every request and gates protected routes.
 * Role checks happen in server layouts/route handlers and in RLS, not here.
 */
export async function updateSession(request: NextRequest) {
  // Forward the current path so server components can build /login?redirectTo= links.
  const forward = () => {
    const headers = new Headers(request.headers)
    headers.set("x-pathname", `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.next({ request: { headers } })
  }
  let response = forward()

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = forward()
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        },
      },
    },
  )

  // Do not run code between createServerClient and getClaims(): it refreshes the session.
  // getClaims() verifies the JWT (locally with asymmetric keys, otherwise via the Auth server).
  const { data } = await supabase.auth.getClaims()
  const isSignedIn = Boolean(data?.claims?.sub)

  const { pathname, search } = request.nextUrl
  const hadSessionCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))

  if (!isSignedIn && isProtectedPath(pathname)) {
    const target = request.nextUrl.clone()
    const [path, query] = loginUrl(`${pathname}${search}`, hadSessionCookie ? "session_expired" : undefined).split("?")
    target.pathname = path ?? "/login"
    target.search = query ? `?${query}` : ""
    return redirectWithCookies(target, response)
  }

  if (isSignedIn && isGuestOnlyPath(pathname)) {
    const target = request.nextUrl.clone()
    const next = safeRedirectPath(request.nextUrl.searchParams.get("redirectTo"), DEFAULT_AFTER_LOGIN)
    const [path, query] = next.split("?")
    target.pathname = path ?? DEFAULT_AFTER_LOGIN
    target.search = query ? `?${query}` : ""
    return redirectWithCookies(target, response)
  }

  return response
}

/** Redirect while keeping any refreshed auth cookies set on `response`. */
function redirectWithCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url)
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
  return redirect
}
