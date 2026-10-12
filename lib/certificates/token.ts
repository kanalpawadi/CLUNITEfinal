import { z } from "zod"
import { hmacBase64Url, safeEqual } from "../crypto.ts"

/**
 * Certificate verification code: `CRT1.<base64url({ aid })>.<base64url(HMAC-SHA256)>`.
 * The payload is `{ aid }` (attendance row: participation) or `{ rid }` (published result: achievement),
 * opaque UUIDs only, so the QR itself carries no personal data.
 * Certificates don't expire; a certificate becomes invalid if its attendance row is deleted.
 * A different prefix from ID-card QRs means one token type can never be replayed as the other.
 */
export const CERT_PREFIX = "CRT1"

const payloadSchema = z.union([
  z.object({ aid: z.string().uuid() }).strict(),
  z.object({ rid: z.string().uuid() }).strict(),
])

export type CertificateRef = { aid: string } | { rid: string }

const input = (body: string) => `${CERT_PREFIX}.${body}`

export function signCertificateToken(ref: string | CertificateRef, secret: string): string {
  const payload: CertificateRef = typeof ref === "string" ? { aid: ref } : ref
  const body = Buffer.from(JSON.stringify(payloadSchema.parse(payload))).toString("base64url")
  return `${input(body)}.${hmacBase64Url(secret, input(body))}`
}

export function verifyCertificateToken(token: string, secret: string): { ok: true; ref: CertificateRef } | { ok: false } {
  const parts = token.trim().split(".")
  if (token.length > 512 || parts.length !== 3 || parts[0] !== CERT_PREFIX || !parts[1] || !parts[2]) return { ok: false }
  const [, body, sig] = parts as [string, string, string]
  if (!safeEqual(hmacBase64Url(secret, input(body)), sig)) return { ok: false }
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")))
    return parsed.success ? { ok: true, ref: parsed.data } : { ok: false }
  } catch {
    return { ok: false }
  }
}
