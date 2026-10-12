import { z } from "zod"

// Public values are inlined at build time, so each must be referenced literally.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_AUTH_MAGIC_LINK_ENABLED: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
})

const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED || undefined,
  NEXT_PUBLIC_AUTH_MAGIC_LINK_ENABLED: process.env.NEXT_PUBLIC_AUTH_MAGIC_LINK_ENABLED || undefined,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || undefined,
})

if (!parsed.success) {
  throw new Error(
    `Missing or invalid public env vars: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}. ` +
      "Copy .env.example to .env.local and fill it in.",
  )
}

export const publicEnv = parsed.data

/** Sign-in methods to show. Email + password is always on; the others follow env flags. */
export const authProviders = {
  password: true,
  magicLink: publicEnv.NEXT_PUBLIC_AUTH_MAGIC_LINK_ENABLED !== "false",
  google: publicEnv.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true",
} as const

/** Origin used in auth email links (prefers the browser origin so previews work). */
export function siteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin
  return publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
}

export function authCallbackUrl(next: string): string {
  return `${siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`
}
