import { z } from "zod"
import { hmacBase64Url, safeEqual } from "../crypto.ts"

/**
 * Certificate verification code: `CRT1.<base64url({ aid })>.<base64url(HMAC-SHA256)>`.
 * `aid` is the attendance row id (an opaque UUID), so the QR itself carries no personal data.
 * Certificates don't expire; a certificate becomes invalid if its attendance row is deleted.
 * A different prefix from ID-card QRs means one token type can never be replayed as the other.
 */
export const CERT_PREFIX = "CRT1"

const payloadSchema = z.object({ aid: z.string().uuid() }).strict()

const input = (body: string) => `${CERT_PREFIX}.${body}`

export function signCertificateToken(attendanceId: string, secret: string): string {
  const body = Buffer.from(JSON.stringify(payloadSchema.parse({ aid: attendanceId }))).toString("base64url")
  return `${input(body)}.${hmacBase64Url(secret, input(body))}`
}

export function verifyCertificateToken(token: string, secret: string): { ok: true; attendanceId: string } | { ok: false } {
  const parts = token.trim().split(".")
  if (token.length > 512 || parts.length !== 3 || parts[0] !== CERT_PREFIX || !parts[1] || !parts[2]) return { ok: false }
  const [, body, sig] = parts as [string, string, string]
  if (!safeEqual(hmacBase64Url(secret, input(body)), sig)) return { ok: false }
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")))
    return parsed.success ? { ok: true, attendanceId: parsed.data.aid } : { ok: false }
  } catch {
    return { ok: false }
  }
}
