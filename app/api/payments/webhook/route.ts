import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { clientIp, enforceRateLimit, handler, jsonError } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyRazorpayWebhookSignature } from "@/lib/payments/server"

const eventSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z
      .object({
        entity: z.object({
          id: z.string(),
          order_id: z.string().nullable(),
          error_description: z.string().nullable().optional(),
        }),
      })
      .optional(),
    order: z.object({ entity: z.object({ id: z.string() }) }).optional(),
  }),
})

/**
 * Razorpay webhook (payment.captured, order.paid, payment.failed).
 * Verifies the HMAC signature of the RAW body before parsing; finalize_payment() makes replays no-ops.
 */
export const POST = handler(async (request: NextRequest) => {
  enforceRateLimit("pay-webhook", clientIp(request), { limit: 120, windowMs: 60_000 })
  const signature = request.headers.get("x-razorpay-signature")
  const rawBody = await request.text()
  if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature)) {
    return jsonError(400, "Invalid signature")
  }

  let parsed: z.infer<typeof eventSchema>
  try {
    parsed = eventSchema.parse(JSON.parse(rawBody))
  } catch {
    return jsonError(400, "Malformed payload")
  }

  const payment = parsed.payload.payment?.entity
  const orderId = payment?.order_id ?? parsed.payload.order?.entity.id
  if (!orderId) return NextResponse.json({ ok: true, ignored: "no order" })

  let success: boolean | null = null
  if (parsed.event === "payment.captured" || parsed.event === "order.paid") success = true
  if (parsed.event === "payment.failed") success = false
  if (success === null) return NextResponse.json({ ok: true, ignored: parsed.event })

  const admin = createAdminClient()
  const { data: existing } = await admin.from("payments").select("id").eq("razorpay_order_id", orderId).maybeSingle()
  if (!existing) {
    // Not ours (or created elsewhere): acknowledge so Razorpay stops retrying.
    return NextResponse.json({ ok: true, ignored: "unknown order" })
  }

  const { error } = await admin.rpc("finalize_payment", {
    p_order_id: orderId,
    p_payment_id: payment?.id ?? "",
    p_success: success,
    p_failure_reason: success ? undefined : (payment?.error_description ?? "Payment failed"),
  })
  // 5xx makes Razorpay retry later, which is what we want on a transient DB error.
  if (error) return jsonError(500, "Could not record payment")
  return NextResponse.json({ ok: true })
})
