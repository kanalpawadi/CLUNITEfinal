import { NextResponse } from "next/server"
import { ApiError, clientIp, enforceRateLimit, handler, parseJson, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { publicEnv } from "@/lib/env"
import { createOrderSchema, type CreateOrderResponse } from "@/lib/payments/schema"
import { mockCreateOrder, paymentsMode, razorpayCreateOrder } from "@/lib/payments/server"

/**
 * Creates a payment order. The amount is ALWAYS read from the database (event fee or plan price),
 * never from the client. Writes the `payments` row with the service role.
 */
export const POST = handler(async (request) => {
  const { user } = await requireUser()
  enforceRateLimit("pay-order:user", user.id, { limit: 10, windowMs: 60_000 })
  enforceRateLimit("pay-order:ip", clientIp(request), { limit: 30, windowMs: 60_000 })
  const input = await parseJson(request, createOrderSchema)
  const admin = createAdminClient()
  const mode = paymentsMode()

  let amount: number
  let description: string
  let row: {
    purpose: "event" | "membership"
    club_id: string
    event_id?: string
    registration_id?: string
    plan_id?: string
    currency: string
  }

  if (input.purpose === "event") {
    const { data: event } = await admin
      .from("events")
      .select("id, title, fee, status, club_id")
      .eq("id", input.eventId)
      .maybeSingle()
    if (!event || event.status !== "published") throw new ApiError(404, "Event not found")
    if (event.fee <= 0) throw new ApiError(400, "This event is free; no payment needed")

    const { data: registration } = await admin
      .from("event_registrations")
      .select("id, status, payment_status")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!registration || registration.status === "cancelled") throw new ApiError(409, "Register for the event before paying")
    if (registration.payment_status === "paid") throw new ApiError(409, "You've already paid for this event")

    amount = event.fee
    description = `Registration: ${event.title}`
    row = { purpose: "event", club_id: event.club_id, event_id: event.id, registration_id: registration.id, currency: "INR" }
  } else {
    const { data: plan } = await admin
      .from("membership_plans")
      .select("id, name, price, currency, duration_days, is_active, club:clubs(id, name, is_active)")
      .eq("id", input.planId)
      .maybeSingle()
    if (!plan || !plan.is_active || !plan.club?.is_active) throw new ApiError(404, "Plan not found")
    if (plan.price <= 0) throw new ApiError(400, "This plan is free; join directly")

    const { data: membership } = await admin
      .from("club_memberships")
      .select("plan_id, status, expires_at")
      .eq("club_id", plan.club.id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (membership?.status === "suspended") throw new ApiError(403, "Your membership is suspended. Contact the club.")
    if (membership?.status === "active" && membership.plan_id === plan.id && membership.expires_at === null) {
      throw new ApiError(409, "You already have this plan and it never expires")
    }

    amount = plan.price
    description = `${plan.club.name}: ${plan.name} membership`
    row = { purpose: "membership", club_id: plan.club.id, plan_id: plan.id, currency: plan.currency }
  }

  const receipt = `rcpt_${Date.now().toString(36)}`
  const order: { orderId: string; amountMinor: number; currency: string; mockToken?: string } =
    mode === "razorpay"
      ? await razorpayCreateOrder({
          amount,
          currency: row.currency,
          receipt,
          notes: { user_id: user.id, purpose: row.purpose, ref: row.event_id ?? row.plan_id ?? "" },
        })
      : mockCreateOrder({ amount, currency: row.currency })

  const { error } = await admin.from("payments").insert({
    user_id: user.id,
    razorpay_order_id: order.orderId,
    amount,
    currency: row.currency,
    status: "created",
    provider: mode,
    purpose: row.purpose,
    club_id: row.club_id,
    event_id: row.event_id ?? null,
    registration_id: row.registration_id ?? null,
    plan_id: row.plan_id ?? null,
  })
  if (error) throw new ApiError(500, "Could not start the payment, please retry")

  const base = { orderId: order.orderId, amount, amountMinor: order.amountMinor, currency: order.currency, description }
  const body: CreateOrderResponse =
    order.mockToken !== undefined
      ? { ...base, mode: "mock", mockToken: order.mockToken }
      : { ...base, mode: "razorpay", keyId: publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "" }
  return NextResponse.json(body)
})
