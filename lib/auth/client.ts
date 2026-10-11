"use client"

import { loginUrl } from "./redirect"

type Router = { replace: (href: string) => void }

/** Sends the browser to /login and brings the user back to the current page afterwards. */
export function redirectToLogin(router: Router, reason: "session_expired" | "auth_required" = "auth_required") {
  const here = typeof window === "undefined" ? "/dashboard" : `${window.location.pathname}${window.location.search}`
  router.replace(loginUrl(here, reason))
}
