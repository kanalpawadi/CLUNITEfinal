import { z } from "zod"
import { hmacBase64Url, safeEqual } from "../crypto.ts"

/**
 * QR credential token: `CLU1.<base64url(JSON payload)>.<base64url(HMAC-SHA256)>`.
 * The payload holds only opaque ids (no names, emails or phone numbers) and a short expiry.
 * Revocation: the server compares `v` with id_credentials.token_version on every scan.
 */
export const QR_PREFIX = "CLU1"
export const QR_TTL_SECONDS = 300

const payloadSchema = z
  .object({
    uid: z.string().uuid(),
    cid: z.string().uuid(),
    v: z.number().int().positive(),
    eid: z.string().uuid().optional(),
    exp: z.number().int().positive(),
  })
  .strict()

export type QrPayload = z.infer<typeof payloadSchema>

export type QrVerifyResult =
  | { ok: true; payload: QrPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired"; payload?: QrPayload }

const signingInput = (body: string) => `${QR_PREFIX}.${body}`

export function signQrToken(payload: QrPayload, secret: string): string {
  if (secret.length < 32) throw new Error("QR signing secret must be at least 32 characters")
  const body = Buffer.from(JSON.stringify(payloadSchema.parse(payload))).toString("base64url")
  return `${signingInput(body)}.${hmacBase64Url(secret, signingInput(body))}`
}

export function verifyQrToken(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): QrVerifyResult {
  const trimmed = token.trim()
  if (trimmed.length > 1024) return { ok: false, reason: "malformed" }
  const parts = trimmed.split(".")
  if (parts.length !== 3 || parts[0] !== QR_PREFIX || !parts[1] || !parts[2]) return { ok: false, reason: "malformed" }
  const [, body, signature] = parts as [string, string, string]

  // Signature first: never parse or trust unsigned content.
  if (!safeEqual(hmacBase64Url(secret, signingInput(body)), signature)) return { ok: false, reason: "bad_signature" }

  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  } catch {
    return { ok: false, reason: "malformed" }
  }
  const parsed = payloadSchema.safeParse(decoded)
  if (!parsed.success) return { ok: false, reason: "malformed" }
  if (parsed.data.exp <= nowSeconds) return { ok: false, reason: "expired", payload: parsed.data }
  return { ok: true, payload: parsed.data }
}
