"use client"

import { loginUrl } from "@/lib/auth/redirect"

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = "ApiClientError"
  }
}

/**
 * POST JSON to one of our API routes. A 401 means the session ended: send the user to sign in
 * and bring them back to this page.
 */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    })
  } catch {
    throw new ApiClientError(0, "Network error. Check your connection and try again.")
  }

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
        ? data.error
        : "Something went wrong. Please try again."
    const code = typeof data === "object" && data !== null && "code" in data && typeof data.code === "string" ? data.code : undefined
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.assign(loginUrl(`${window.location.pathname}${window.location.search}`, "session_expired"))
    }
    throw new ApiClientError(response.status, message, code)
  }
  return data as T
}
