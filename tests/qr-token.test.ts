import { test } from "node:test"
import assert from "node:assert/strict"
import { signQrToken, verifyQrToken, QR_TTL_SECONDS } from "../lib/qr/token.ts"
import { hmacHex, safeEqual } from "../lib/crypto.ts"
import { signCertificateToken, verifyCertificateToken } from "../lib/certificates/token.ts"

const SECRET = "test-secret-test-secret-test-secret-123"
const NOW = 1_800_000_000
const payload = {
  uid: "00000000-0000-4000-8000-00000000000b",
  cid: "00000000-0000-4000-8000-0000000000c1",
  v: 1,
  exp: NOW + QR_TTL_SECONDS,
}

test("valid token round-trips", () => {
  const token = signQrToken(payload, SECRET)
  assert.match(token, /^CLU1\.[\w-]+\.[\w-]+$/)
  const r = verifyQrToken(token, SECRET, NOW)
  assert.equal(r.ok, true)
  if (r.ok) assert.deepEqual(r.payload, payload)
})

test("token carries no personal data", () => {
  const body = signQrToken(payload, SECRET).split(".")[1] ?? ""
  const decoded: Record<string, unknown> = JSON.parse(Buffer.from(body, "base64url").toString())
  assert.deepEqual(Object.keys(decoded).sort(), ["cid", "exp", "uid", "v"])
})

test("tampered payload is rejected", () => {
  const [prefix, body, sig] = signQrToken(payload, SECRET).split(".") as [string, string, string]
  const forged = Buffer.from(JSON.stringify({ ...payload, uid: "00000000-0000-4000-8000-0000000000ff" })).toString("base64url")
  assert.deepEqual(verifyQrToken(`${prefix}.${forged}.${sig}`, SECRET, NOW), { ok: false, reason: "bad_signature" })
  assert.equal(verifyQrToken(`${prefix}.${body}.${sig.slice(0, -2)}xx`, SECRET, NOW).ok, false)
})

test("wrong secret is rejected", () => {
  const token = signQrToken(payload, SECRET)
  assert.deepEqual(verifyQrToken(token, `${SECRET}-other`, NOW), { ok: false, reason: "bad_signature" })
})

test("expired token is rejected", () => {
  const token = signQrToken(payload, SECRET)
  const r = verifyQrToken(token, SECRET, payload.exp)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.reason, "expired")
})

test("malformed input is rejected without throwing", () => {
  for (const bad of ["", "CLU1", "CLU1..", "XYZ.a.b", "CLU1.%%%.sig", "a".repeat(5000)]) {
    assert.equal(verifyQrToken(bad, SECRET, NOW).ok, false, bad.slice(0, 20))
  }
})

test("unknown payload fields are rejected even when signed", () => {
  // strict schema: a validly signed token with extra (e.g. personal) data is refused
  assert.throws(() => signQrToken({ ...payload, email: "x@y.z" } as typeof payload, SECRET))
})

test("payment signature helpers (Razorpay format)", () => {
  // Razorpay docs: HMAC_SHA256(order_id + "|" + razorpay_payment_id, secret)
  const sig = hmacHex("rzp_secret", "order_123|pay_456")
  assert.equal(safeEqual(sig, hmacHex("rzp_secret", "order_123|pay_456")), true)
  assert.equal(safeEqual(sig, hmacHex("rzp_secret", "order_123|pay_457")), false)
  assert.equal(safeEqual(sig, sig.slice(0, -1)), false)
})


test("certificate token verifies and rejects tampering or ID-card tokens", () => {
  const aid = "00000000-0000-4000-8000-0000000000a1"
  const token = signCertificateToken(aid, SECRET)
  assert.deepEqual(verifyCertificateToken(token, SECRET), { ok: true, ref: { aid } })
  const rid = "00000000-0000-4000-8000-0000000000b1"
  assert.deepEqual(verifyCertificateToken(signCertificateToken({ rid }, SECRET), SECRET), { ok: true, ref: { rid } })
  assert.deepEqual(verifyCertificateToken(token, `${SECRET}x`), { ok: false })
  const [, , sig] = token.split(".")
  const forged = Buffer.from(JSON.stringify({ aid: "00000000-0000-4000-8000-0000000000a2" })).toString("base64url")
  assert.deepEqual(verifyCertificateToken(`CRT1.${forged}.${sig}`, SECRET), { ok: false })
  // an ID-card QR must not verify as a certificate
  assert.deepEqual(verifyCertificateToken(signQrToken(payload, SECRET), SECRET), { ok: false })
})
