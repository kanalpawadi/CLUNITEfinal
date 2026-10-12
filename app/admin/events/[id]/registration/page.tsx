import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { hasClubRole, isSuperAdmin } from "@/lib/auth/server"
import { parseQuestions } from "@/lib/questions"
import { formatDateTime } from "@/lib/events"
import { AnnouncementComposer, QuestionsEditor } from "@/components/admin/RegistrationTools"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Registrations · Clunite" }

export default async function RegistrationAdminPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  const supabase = createClient()
  const { data: event } = await supabase
    .from("events")
    .select("id, title, club_id, registration_questions, current_participants, club:clubs(name)")
    .eq("id", params.id)
    .maybeSingle()
  if (!event) notFound()
  const allowed = (await hasClubRole(event.club_id, ["owner", "admin", "organizer", "treasurer"])) || (await isSuperAdmin())
  if (!allowed) notFound()
  const canEdit = (await hasClubRole(event.club_id, ["owner", "admin", "organizer"])) || (await isSuperAdmin())

  const [{ count: registrants }, { data: announcements }] = await Promise.all([
    supabase.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "registered"),
    supabase.from("event_announcements").select("id, title, body, created_at, emailed_count").eq("event_id", event.id).order("created_at", { ascending: false }),
  ])

  return (
    <main id="main" className="space-y-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{event.club?.name} · registrations</p>
          <h1 className="text-2xl font-semibold text-foreground">{event.title}</h1>
          <p className="text-sm tabular-nums text-muted-foreground">
            {registrants ?? 0} registrations · {event.current_participants} people
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={`/api/events/${event.id}/registrations.csv`} download>
              <Download className="mr-2 h-4 w-4" aria-hidden /> Export CSV
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/events/${event.id}/competition`}>Competition</Link>
          </Button>
        </div>
      </header>

      {canEdit && (
        <section aria-labelledby="form-h" className="space-y-4">
          <h2 id="form-h" className="text-lg font-semibold text-foreground">Registration form</h2>
          <p className="text-sm text-muted-foreground">Extra questions shown when people register. Answers appear in the CSV export.</p>
          <QuestionsEditor eventId={event.id} initial={parseQuestions(event.registration_questions)} />
        </section>
      )}

      <section aria-labelledby="ann-h" className="space-y-4">
        <h2 id="ann-h" className="text-lg font-semibold text-foreground">Announcements</h2>
        {canEdit && <AnnouncementComposer eventId={event.id} registrants={registrants ?? 0} />}
        {(announcements ?? []).length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {(announcements ?? []).map((a) => (
              <li key={a.id} className="space-y-1 px-4 py-3">
                <p className="font-medium text-foreground">{a.title}</p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(a.created_at)}
                  {a.emailed_count > 0 && ` · emailed to ${a.emailed_count}`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        )}
      </section>
    </main>
  )
}
