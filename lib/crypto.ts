import { createHmac, timingSafeEqual } from "node:crypto"

/** HMAC-SHA256 as lowercase hex. */
export const hmacHex = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("hex")

/** HMAC-SHA256 as base64url (compact, for tokens). */
export const hmacBase64Url = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url")

/** Constant-time string comparison (false on length mismatch, without early exit on content). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}
