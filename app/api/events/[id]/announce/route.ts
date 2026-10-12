import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, enforceRateLimit, handler, parseJson, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { messageEmail, sendEmailBatch } from "@/lib/email"
import { requestOrigin } from "@/lib/certificates/server"

const bodySchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(5000),
  email: z.boolean().default(false),
})

/**
 * Organizer announcement: stored under RLS (only owner/admin/organizer can insert), which also
 * fans out in-app notifications via trigger; optionally emailed to every registrant + team member.
 */
export const POST = handler(async (request, { params }: { params: { id: string } }) => {
  const eventId = z.string().uuid().safeParse(params.id)
  if (!eventId.success) throw new ApiError(400, "Invalid event")
  const { supabase, user } = await requireUser()
  enforceRateLimit("announce", user.id, { limit: 5, windowMs: 60 * 60 * 1000 })
  const input = await parseJson(request, bodySchema)

  const { data: announcement, error } = await supabase
    .from("event_announcements")
    .insert({ event_id: eventId.data, author_id: user.id, title: input.title, body: input.body })
    .select("id")
    .single()
  if (error || !announcement) throw new ApiError(403, "Only this club's organizers can post announcements")

  let emailed = 0
  if (input.email) {
    const admin = createAdminClient()
    const { data: event } = await admin.from("events").select("title").eq("id", eventId.data).single()
    const { data: regs } = await admin
      .from("event_registrations")
      .select("user:users!event_registrations_user_id_fkey(email), team_members(user:users(email))")
      .eq("event_id", eventId.data)
      .eq("status", "registered")
    const emails = new Set<string>()
    for (const r of regs ?? []) {
      if (r.user?.email) emails.add(r.user.email)
      for (const m of r.team_members ?? []) if (m.user?.email) emails.add(m.user.email)
    }
    const html = messageEmail({
      heading: input.title,
      body: input.body,
      ctaText: "Open event",
      ctaUrl: `${requestOrigin()}/events/${eventId.data}/register`,
    })
    emailed = await sendEmailBatch([...emails].map((to) => ({ to, subject: `[${event?.title ?? "Event"}] ${input.title}`, html })))
    await admin.from("event_announcements").update({ emailed_count: emailed }).eq("id", announcement.id)
  }
  return NextResponse.json({ id: announcement.id, emailed })
})
