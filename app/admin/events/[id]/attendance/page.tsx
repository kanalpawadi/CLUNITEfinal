import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { QrCode } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { hasClubRole, isSuperAdmin } from "@/lib/auth/server"
import { formatDateTime } from "@/lib/events"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Attendance · Clunite" }

export default async function AttendancePage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  const supabase = createClient()
  const { data: event } = await supabase
    .from("events")
    .select("id, title, starts_at, club_id, current_participants, fee, club:clubs(name)")
    .eq("id", params.id)
    .maybeSingle()
  if (!event) notFound()

  // Server-side role check for this event's club (RLS enforces the same on the queries below)
  const allowed = (await hasClubRole(event.club_id, ["owner", "admin", "organizer", "treasurer"])) || (await isSuperAdmin())
  if (!allowed) notFound()

  const [{ data: attendance }, { data: registrations }] = await Promise.all([
    supabase
      .from("attendance")
      .select(
        "id, user_id, checked_in_at, attendee:users!attendance_user_id_fkey(full_name, email), scanner:users!attendance_checked_in_by_fkey(full_name)",
      )
      .eq("event_id", event.id)
      .order("checked_in_at", { ascending: false }),
    supabase
      .from("event_registrations")
      .select("user_id, status, payment_status, user:users!event_registrations_user_id_fkey(full_name, email)")
      .eq("event_id", event.id)
      .eq("status", "registered"),
  ])

  const checkedIn = new Set((attendance ?? []).map((a) => a.user_id))
  const noShows = (registrations ?? []).filter((r) => !checkedIn.has(r.user_id))
  const registered = registrations?.length ?? 0
  const rate = registered > 0 ? Math.round(((attendance?.length ?? 0) / registered) * 100) : 0

  return (
    <main id="main" className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{event.club?.name}</p>
          <h1 className="text-2xl font-semibold text-foreground">{event.title}</h1>
          <p className="text-sm text-muted-foreground">{formatDateTime(event.starts_at)}</p>
        </div>
        <Button asChild>
          <Link href={`/admin/scan?event=${event.id}`}>
            <QrCode className="mr-2 h-4 w-4" aria-hidden /> Open scanner
          </Link>
        </Button>
      </header>

      <dl className="grid grid-cols-3 gap-4">
        {[
          ["Checked in", attendance?.length ?? 0],
          ["Registered", registered],
          ["Turnout", `${rate}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="present" className="space-y-3">
        <h2 id="present" className="text-lg font-semibold text-foreground">Checked in</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Attendee</th>
                <th scope="col" className="px-3 py-2 font-medium">Time</th>
                <th scope="col" className="px-3 py-2 font-medium">Scanned by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {(attendance ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2">
                    <p className="text-foreground">{a.attendee?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{a.attendee?.email}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatDateTime(a.checked_in_at)}</td>
                  <td className="px-3 py-2">{a.scanner?.full_name ?? "—"}</td>
                </tr>
              ))}
              {(attendance ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Nobody has checked in yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {noShows.length > 0 && (
        <section aria-labelledby="pending" className="space-y-3">
          <h2 id="pending" className="text-lg font-semibold text-foreground">Not yet arrived ({noShows.length})</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
            {noShows.map((r) => (
              <li key={r.user_id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-foreground">{r.user?.full_name ?? r.user?.email ?? "—"}</span>
                {event.fee > 0 && r.payment_status !== "paid" && (
                  <span className="rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs text-warning">unpaid</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
