import "server-only"
import { z } from "zod"

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  PAYMENTS_MODE: z.enum(["mock", "razorpay"]).default("mock"),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  QR_SIGNING_SECRET: z.string().min(32).optional(),
  CRON_SECRET: z.string().optional(),
})

const blankToUndefined = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : undefined)

export const serverEnv = serverSchema.parse({
  // SUPABASE_SERVICE_ROLE_KEY is accepted as a legacy alias
  SUPABASE_SECRET_KEY: blankToUndefined(process.env.SUPABASE_SECRET_KEY) ?? blankToUndefined(process.env.SUPABASE_SERVICE_ROLE_KEY),
  RESEND_API_KEY: blankToUndefined(process.env.RESEND_API_KEY),
  EMAIL_FROM: blankToUndefined(process.env.EMAIL_FROM),
  PAYMENTS_MODE: blankToUndefined(process.env.PAYMENTS_MODE),
  RAZORPAY_KEY_SECRET: blankToUndefined(process.env.RAZORPAY_KEY_SECRET),
  RAZORPAY_WEBHOOK_SECRET: blankToUndefined(process.env.RAZORPAY_WEBHOOK_SECRET),
  QR_SIGNING_SECRET: blankToUndefined(process.env.QR_SIGNING_SECRET),
  CRON_SECRET: blankToUndefined(process.env.CRON_SECRET),
})

/** Throws a clear configuration error when a server secret is missing. */
export function requireServerEnv<K extends keyof typeof serverEnv>(key: K): NonNullable<(typeof serverEnv)[K]> {
  const value = serverEnv[key]
  if (value === undefined || value === null || value === "") {
    throw new ConfigError(`${String(key)} is not configured on the server`)
  }
  return value as NonNullable<(typeof serverEnv)[K]>
}

export class ConfigError extends Error {
  readonly name = "ConfigError"
}
