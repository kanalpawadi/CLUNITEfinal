import { z } from "zod"

export const createOrderSchema = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal("event"), eventId: z.string().uuid() }),
  z.object({ purpose: z.literal("membership"), planId: z.string().uuid() }),
])
export type CreateOrderInput = z.infer<typeof createOrderSchema>

export type CreateOrderResponse = {
  orderId: string
  amount: number
  amountMinor: number
  currency: string
  description: string
} & ({ mode: "mock"; mockToken: string } | { mode: "razorpay"; keyId: string })

export const verifySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("razorpay"),
    orderId: z.string().min(6).max(64),
    paymentId: z.string().min(6).max(64),
    signature: z.string().regex(/^[a-f0-9]{64}$/, "Invalid signature format"),
  }),
  z.object({
    mode: z.literal("mock"),
    orderId: z.string().min(6).max(64),
    mockToken: z.string().regex(/^[a-f0-9]{64}$/),
    outcome: z.enum(["success", "failure"]),
  }),
  z.object({
    // Checkout closed with an error (Razorpay `payment.failed`): only moves a `created` order to `failed`
    mode: z.literal("failed"),
    orderId: z.string().min(6).max(64),
    reason: z.string().max(300).optional(),
  }),
])
export type VerifyInput = z.infer<typeof verifySchema>

export type VerifyResponse = {
  paymentId: string
  status: "created" | "paid" | "failed" | "refunded"
  receiptNo: string | null
}
