import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { hasClubRole, isSuperAdmin } from "@/lib/auth/server"
import { JudgingPanel, ResultsEditor, RoundsEditor, type AdminRegistration } from "@/components/competitions/CompetitionAdmin"

export const metadata: Metadata = { title: "Competition · Clunite" }

export default async function CompetitionAdminPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  const supabase = createClient()
  const { data: event } = await supabase.from("events").select("id, title, club_id, club:clubs(name)").eq("id", params.id).maybeSingle()
  if (!event) notFound()
  const allowed = (await hasClubRole(event.club_id, ["owner", "admin", "organizer"])) || (await isSuperAdmin())
  if (!allowed) notFound()

  const [{ data: rounds }, { data: regs }, { data: results }] = await Promise.all([
    supabase.from("event_rounds").select("*").eq("event_id", event.id).order("round_no"),
    supabase
      .from("event_registrations")
      .select("id, team_name, user:users!event_registrations_user_id_fkey(full_name, email)")
      .eq("event_id", event.id)
      .eq("status", "registered")
      .order("created_at"),
    supabase.from("event_results").select("id, registration_id, position, title, published").eq("event_id", event.id).order("position"),
  ])
  const roundIds = (rounds ?? []).map((r) => r.id)
  const { data: submissions } = roundIds.length
    ? await supabase.from("round_submissions").select("*").in("round_id", roundIds)
    : { data: [] }

  const registrations: AdminRegistration[] = (regs ?? []).map((r) => ({
    id: r.id,
    name: r.user?.full_name ?? r.user?.email ?? "Participant",
    email: r.user?.email ?? null,
    team_name: r.team_name,
  }))

  return (
    <main id="main" className="space-y-10">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{event.club?.name} · competition</p>
          <h1 className="text-2xl font-semibold text-foreground">{event.title}</h1>
          <p className="text-sm tabular-nums text-muted-foreground">{registrations.length} registered teams / participants</p>
        </div>
        <nav aria-label="Related" className="flex flex-wrap gap-3 text-sm">
          <Link href={`/events/${event.id}/leaderboard`} className="text-primary underline-offset-4 hover:underline">Public leaderboard</Link>
          <Link href={`/admin/events/${event.id}/attendance`} className="text-primary underline-offset-4 hover:underline">Attendance</Link>
        </nav>
      </header>

      <section aria-labelledby="rounds-h" className="space-y-4">
        <h2 id="rounds-h" className="text-lg font-semibold text-foreground">Rounds</h2>
        <p className="text-sm text-muted-foreground">
          Round 1 is open to everyone registered. Each later round only accepts teams you shortlist in the round before.
        </p>
        <RoundsEditor eventId={event.id} rounds={rounds ?? []} />
      </section>

      <section aria-labelledby="judge-h" className="space-y-4">
        <h2 id="judge-h" className="text-lg font-semibold text-foreground">Judging</h2>
        <JudgingPanel rounds={rounds ?? []} registrations={registrations} submissions={submissions ?? []} />
      </section>

      <section aria-labelledby="results-h" className="space-y-4">
        <h2 id="results-h" className="text-lg font-semibold text-foreground">Final results</h2>
        <p className="text-sm text-muted-foreground">Published winners appear on the event page and receive a certificate of achievement.</p>
        <ResultsEditor eventId={event.id} registrations={registrations} results={results ?? []} />
      </section>
    </main>
  )
}
