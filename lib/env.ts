import { z } from "zod"

// Public values are inlined at build time, so each must be referenced literally.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
})

const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED || undefined,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || undefined,
})

if (!parsed.success) {
  throw new Error(
    `Missing or invalid public env vars: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}. ` +
      "Copy .env.example to .env.local and fill it in.",
  )
}

export const publicEnv = parsed.data

export const authProviders = {
  google: publicEnv.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true",
} as const
