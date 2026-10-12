import "server-only"
import { NextResponse, type NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"
import { z, type ZodTypeAny } from "zod"
import { createClient } from "@/lib/supabase/server"
import { ConfigError } from "@/lib/env.server"
import { rateLimit, type RateLimitOptions } from "@/lib/rate-limit"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function jsonError(status: number, message: string, code?: string, headers?: HeadersInit) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status, headers })
}

/** Signed-in user (verified with the Auth server) plus a user-scoped Supabase client. */
export async function requireUser() {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, "Please sign in to continue", "unauthenticated")
  return { supabase, user }
}

export async function parseJson<S extends ZodTypeAny>(request: NextRequest | Request, schema: S): Promise<z.infer<S>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiError(400, "Request body must be JSON", "invalid_json")
  }
  const result = schema.safeParse(body)
  if (!result.success) {
    const first = result.error.issues[0]
    throw new ApiError(400, first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request", "invalid_body")
  }
  return result.data
}

export function clientIp(request: NextRequest | Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
}

/** Throws 429 when the caller exceeds the limit for `bucket`. */
export function enforceRateLimit(bucket: string, key: string, options: RateLimitOptions) {
  const result = rateLimit(`${bucket}:${key}`, options)
  if (!result.ok) {
    throw new ApiError(429, `Too many requests. Try again in ${Math.ceil(result.retryAfterMs / 1000)}s.`, "rate_limited")
  }
}

/** Wraps a route handler: maps ApiError/ConfigError/unknown errors to safe JSON responses. */
export function handler<C>(fn: (request: NextRequest, context: C) => Promise<Response>) {
  return async (request: NextRequest, context: C): Promise<Response> => {
    try {
      return await fn(request, context)
    } catch (err) {
      // Next.js control flow (dynamic-usage bailout, redirect, notFound) must propagate untouched
      if (typeof err === "object" && err !== null && "digest" in err && typeof err.digest === "string") throw err
      if (err instanceof ApiError) return jsonError(err.status, err.message, err.code)
      if (err instanceof ConfigError) {
        console.error(`[config] ${err.message}`)
        return jsonError(503, "This feature is not configured on the server yet", "not_configured")
      }
      console.error("[api] unexpected error", err instanceof Error ? err.message : err)
      return jsonError(500, "Something went wrong. Please try again.", "internal")
    }
  }
}

export type AuthedUser = User
