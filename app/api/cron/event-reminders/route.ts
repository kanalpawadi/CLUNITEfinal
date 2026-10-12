import { NextResponse } from "next/server"
import { ApiError, handler } from "@/lib/api"
import { requireServerEnv } from "@/lib/env.server"
import { createAdminClient } from "@/lib/supabase/admin"
import { safeEqual } from "@/lib/crypto"
import { messageEmail, sendEmailBatch } from "@/lib/email"
import { formatDateTime } from "@/lib/events"
import { publicEnv } from "@/lib/env"

export const dynamic = "force-dynamic"

/**
 * Emails a reminder ~24h before an event to registrants who haven't had one.
 * Call hourly with `Authorization: Bearer $CRON_SECRET` (e.g. Vercel Cron).
 */
export const GET = handler(async (request) => {
  if (!safeEqual(request.headers.get("authorization") ?? "", `Bearer ${requireServerEnv("CRON_SECRET")}`)) {
    throw new ApiError(401, "Unauthorized")
  }
  const admin = createAdminClient()
  const now = Date.now()
  const { data: events } = await admin
    .from("events")
    .select("id, title, starts_at, venue")
    .eq("status", "published")
    .gte("starts_at", new Date(now + 20 * 3600_000).toISOString())
    .lte("starts_at", new Date(now + 26 * 3600_000).toISOString())

  const origin = publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
  let sent = 0
  for (const event of events ?? []) {
    const { data: regs } = await admin
      .from("event_registrations")
      .select("id, user:users!event_registrations_user_id_fkey(email)")
      .eq("event_id", event.id)
      .eq("status", "registered")
      .is("reminder_sent_at", null)
    const targets = (regs ?? []).filter((r) => r.user?.email)
    if (targets.length === 0) continue
    // Mark first so a crash mid-send can't cause duplicates on the next run
    await admin
      .from("event_registrations")
      .update({ reminder_sent_at: new Date().toISOString() })
      .in("id", targets.map((r) => r.id))
    const html = messageEmail({
      heading: `Tomorrow: ${event.title}`,
      body: `Starts ${formatDateTime(event.starts_at)} at ${event.venue ?? "the venue on the event page"}.\n\nKeep your QR ID card ready for check-in.`,
      ctaText: "Open my ID card",
      ctaUrl: `${origin}/dashboard/student/qr`,
    })
    sent += await sendEmailBatch(targets.map((r) => ({ to: r.user?.email ?? "", subject: `Reminder: ${event.title} is tomorrow`, html })))
  }
  return NextResponse.json({ events: events?.length ?? 0, sent })
})
