import { NextResponse } from "next/server"
import { ApiError, enforceRateLimit, handler, parseJson, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifySchema, type VerifyResponse } from "@/lib/payments/schema"
import { mockPaymentId, paymentsMode, verifyMockToken, verifyRazorpayPaymentSignature } from "@/lib/payments/server"

/**
 * Confirms a checkout. Razorpay: HMAC-SHA256 signature check (timing-safe). Mock: server-issued token.
 * Finalisation (marking the registration/membership, income ledger row) happens atomically in
 * finalize_payment(), which is idempotent with the webhook.
 */
export const POST = handler(async (request) => {
  const { user } = await requireUser()
  enforceRateLimit("pay-verify", user.id, { limit: 20, windowMs: 60_000 })
  const input = await parseJson(request, verifySchema)
  const admin = createAdminClient()

  const { data: payment } = await admin
    .from("payments")
    .select("id, user_id, provider, status")
    .eq("razorpay_order_id", input.orderId)
    .maybeSingle()
  if (!payment || payment.user_id !== user.id) throw new ApiError(404, "Order not found")

  let success: boolean
  let providerPaymentId: string | null = null
  let reason: string | undefined

  switch (input.mode) {
    case "razorpay":
      if (payment.provider !== "razorpay") throw new ApiError(400, "Order was not created with Razorpay")
      if (!verifyRazorpayPaymentSignature(input.orderId, input.paymentId, input.signature)) {
        throw new ApiError(400, "Payment signature is invalid", "bad_signature")
      }
      success = true
      providerPaymentId = input.paymentId
      break
    case "mock":
      if (payment.provider !== "mock" || paymentsMode() !== "mock") throw new ApiError(400, "Mock payments are disabled")
      if (!verifyMockToken(input.orderId, input.mockToken)) throw new ApiError(400, "Invalid mock token", "bad_signature")
      success = input.outcome === "success"
      providerPaymentId = success ? mockPaymentId() : null
      reason = success ? undefined : "Simulated failure (mock mode)"
      break
    case "failed":
      if (payment.status !== "created") {
        return NextResponse.json({ paymentId: payment.id, status: payment.status, receiptNo: null } satisfies VerifyResponse)
      }
      success = false
      reason = input.reason ?? "Payment failed at checkout"
      break
  }

  const { data: result, error } = await admin.rpc("finalize_payment", {
    p_order_id: input.orderId,
    p_payment_id: providerPaymentId ?? "",
    p_success: success,
    p_failure_reason: reason,
  })
  if (error || !result) throw new ApiError(500, "Could not record the payment. If you were charged, it will be reconciled automatically.")

  return NextResponse.json({ paymentId: result.id, status: result.status, receiptNo: result.receipt_no } satisfies VerifyResponse)
})
