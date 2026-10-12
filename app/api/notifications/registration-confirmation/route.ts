import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, enforceRateLimit, handler, parseJson, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { messageEmail, sendEmail } from "@/lib/email"
import { formatDateTime } from "@/lib/events"
import { requestOrigin } from "@/lib/certificates/server"

const bodySchema = z.object({ eventId: z.string().uuid() })

/** Emails a registration confirmation once per registration (called after register_for_event succeeds). */
export const POST = handler(async (request) => {
  const { user } = await requireUser()
  enforceRateLimit("confirm-email", user.id, { limit: 10, windowMs: 60 * 60 * 1000 })
  const { eventId } = await parseJson(request, bodySchema)
  const admin = createAdminClient()

  const { data: reg } = await admin
    .from("event_registrations")
    .select("id, confirmation_sent_at, event:events(title, starts_at, venue, fee)")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .eq("status", "registered")
    .maybeSingle()
  if (!reg?.event) throw new ApiError(404, "Registration not found")
  if (reg.confirmation_sent_at || !user.email) return NextResponse.json({ sent: false })

  // Claim the send first so concurrent calls can't double-email
  const { data: claimed } = await admin
    .from("event_registrations")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", reg.id)
    .is("confirmation_sent_at", null)
    .select("id")
    .maybeSingle()
  if (!claimed) return NextResponse.json({ sent: false })

  const url = `${requestOrigin()}/events/${eventId}/register`
  const sent = await sendEmail({
    to: user.email,
    subject: `You're registered: ${reg.event.title}`,
    html: messageEmail({
      heading: `You're registered for ${reg.event.title}`,
      body: `When: ${formatDateTime(reg.event.starts_at)}\nWhere: ${reg.event.venue ?? "See event page"}${
        reg.event.fee > 0 ? "\n\nIf your registration fee is still pending, complete the payment from the event page." : ""
      }\n\nShow your QR ID card at the entrance to check in.`,
      ctaText: "Open your registration",
      ctaUrl: url,
    }),
  })
  return NextResponse.json({ sent })
})
