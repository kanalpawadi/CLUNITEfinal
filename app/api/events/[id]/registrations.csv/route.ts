import { z } from "zod"
import { ApiError, enforceRateLimit, handler, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseRegistrationData } from "@/lib/registration-data"
import { parseQuestions } from "@/lib/questions"
import { csvCell as cell } from "@/lib/csv"

export const dynamic = "force-dynamic"

/** Registrations export for club staff (owner/admin/organizer/treasurer). */
export const GET = handler(async (_request, { params }: { params: { id: string } }) => {
  const eventId = z.string().uuid().safeParse(params.id)
  if (!eventId.success) throw new ApiError(400, "Invalid event")
  const { supabase, user } = await requireUser()
  enforceRateLimit("csv-export", user.id, { limit: 20, windowMs: 60 * 60 * 1000 })

  const { data: event } = await supabase.from("events").select("id, title, club_id, registration_questions").eq("id", eventId.data).maybeSingle()
  if (!event) throw new ApiError(404, "Event not found")
  const { data: allowed } = await supabase.rpc("is_club_role", {
    club: event.club_id,
    roles: ["owner", "admin", "organizer", "treasurer"],
  })
  if (!allowed) throw new ApiError(403, "Only club staff can export registrations")

  const admin = createAdminClient()
  const [{ data: regs }, { data: attendance }] = await Promise.all([
    admin
      .from("event_registrations")
      .select(
        "id, created_at, status, payment_status, team_name, participant_count, registration_data, user_id, user:users!event_registrations_user_id_fkey(full_name, email, phone, college), team_members(user:users(full_name, email))",
      )
      .eq("event_id", event.id)
      .order("created_at"),
    admin.from("attendance").select("user_id").eq("event_id", event.id),
  ])
  const checkedIn = new Set((attendance ?? []).map((a) => a.user_id))
  const questions = parseQuestions(event.registration_questions)

  const header = [
    "Registered at", "Name", "Email", "Phone", "College", "Team", "Team members", "People",
    "Status", "Payment", "Checked in", ...questions.map((q) => q.label),
  ]
  const lines = [header.map(cell).join(",")]
  for (const r of regs ?? []) {
    const data = parseRegistrationData(r.registration_data)
    const lead = data.participant_details ?? data.team_members?.[0]
    const joined = (r.team_members ?? []).map((m) => m.user?.full_name ?? m.user?.email).filter(Boolean)
    const typed = (data.team_members ?? []).slice(1).map((m) => m.name)
    lines.push(
      [
        r.created_at,
        r.user?.full_name ?? lead?.name,
        r.user?.email ?? lead?.email,
        lead?.phone ?? r.user?.phone,
        lead?.college ?? r.user?.college,
        r.team_name,
        [...joined, ...typed].join("; "),
        r.participant_count,
        r.status,
        r.payment_status ?? "n/a",
        checkedIn.has(r.user_id) ? "yes" : "no",
        ...questions.map((q) => data.answers?.[q.id] ?? ""),
      ]
        .map(cell)
        .join(","),
    )
  }

  const filename = `${event.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event"}-registrations.csv`
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
})
