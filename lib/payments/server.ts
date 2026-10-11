import "server-only"
import { randomBytes } from "node:crypto"
import { hmacHex, safeEqual } from "@/lib/crypto"
import { ConfigError, requireServerEnv, serverEnv } from "@/lib/env.server"
import { publicEnv } from "@/lib/env"

export type PaymentsMode = "mock" | "razorpay"

/** Mode is explicit in production; local/dev defaults to mock. */
export function paymentsMode(): PaymentsMode {
  if (process.env.NODE_ENV === "production" && !process.env.PAYMENTS_MODE) {
    throw new ConfigError("PAYMENTS_MODE must be set explicitly in production (mock or razorpay)")
  }
  return serverEnv.PAYMENTS_MODE
}

export { safeEqual }

export type CreatedOrder = {
  orderId: string
  /** smallest currency unit (paise) */
  amountMinor: number
  currency: string
}

/** Rupees -> paise without floating-point drift. */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}

// --- Razorpay (test mode) -----------------------------------------------------------

export async function razorpayCreateOrder(params: {
  amount: number
  currency: string
  receipt: string
  notes: Record<string, string>
}): Promise<CreatedOrder> {
  const keyId = publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID
  if (!keyId || !keyId.startsWith("rzp_")) throw new ConfigError("NEXT_PUBLIC_RAZORPAY_KEY_ID is not configured")
  const secret = requireServerEnv("RAZORPAY_KEY_SECRET")
  const amountMinor = toMinorUnits(params.amount)

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
    },
    body: JSON.stringify({ amount: amountMinor, currency: params.currency, receipt: params.receipt, notes: params.notes }),
    cache: "no-store",
  })
  if (!response.ok) {
    // Never echo provider responses (may include account details); log status only.
    console.error("[razorpay] create order failed with status", response.status)
    throw new Error("Payment provider rejected the order")
  }
  const order: unknown = await response.json()
  if (typeof order !== "object" || order === null || !("id" in order) || typeof order.id !== "string") {
    throw new Error("Unexpected response from payment provider")
  }
  return { orderId: order.id, amountMinor, currency: params.currency }
}

/** Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = hmacHex(requireServerEnv("RAZORPAY_KEY_SECRET"), `${orderId}|${paymentId}`)
  return safeEqual(expected, signature)
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook_secret). */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = hmacHex(requireServerEnv("RAZORPAY_WEBHOOK_SECRET"), rawBody)
  return safeEqual(expected, signature)
}

// --- Mock (no network) ---------------------------------------------------------------

/** Per-process fallback so mock mode works with zero configuration in development. */
const ephemeralMockSecret = randomBytes(32).toString("hex")

function mockSecret(): string {
  return `mock:${serverEnv.QR_SIGNING_SECRET ?? serverEnv.RAZORPAY_KEY_SECRET ?? ephemeralMockSecret}`
}

export function mockCreateOrder(params: { amount: number; currency: string }): CreatedOrder & { mockToken: string } {
  const orderId = `order_mock_${randomBytes(9).toString("base64url")}`
  return {
    orderId,
    amountMinor: toMinorUnits(params.amount),
    currency: params.currency,
    mockToken: hmacHex(mockSecret(), orderId),
  }
}

/** Proves the mock order was issued by this server (same HMAC + constant-time check as Razorpay). */
export function verifyMockToken(orderId: string, token: string): boolean {
  return safeEqual(hmacHex(mockSecret(), orderId), token)
}

export const mockPaymentId = () => `pay_mock_${randomBytes(9).toString("base64url")}`
