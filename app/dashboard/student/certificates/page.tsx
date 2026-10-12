import type { Metadata } from "next"
import Link from "next/link"
import { Award } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getProfile, requireAuthUser } from "@/lib/auth/server"
import { buildCertificate, requestOrigin, type CertificateData } from "@/lib/certificates/server"
import { Certificate } from "@/components/certificates/Certificate"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Certificates · Clunite" }

/**
 * One participation certificate per attended event (attendance is recorded when staff scan the
 * member's QR). Each carries a signed QR that anyone can scan to verify it.
 */
export default async function CertificatesPage() {
  const user = await requireAuthUser("/dashboard/student/certificates")
  const profile = await getProfile()
  const supabase = createClient()

  const { data: rows, error } = await supabase
    .from("attendance")
    .select("id, checked_in_at, event:events(title, starts_at, club:clubs(name, faculty_in_charge, hod_name))")
    .eq("user_id", user.id)
    .order("checked_in_at", { ascending: false })

  // Achievements: published results for registrations the user leads or is a team member of
  const [{ data: myRegs }, { data: myTeams }] = await Promise.all([
    supabase.from("event_registrations").select("id").eq("user_id", user.id),
    supabase.from("team_members").select("registration_id").eq("user_id", user.id),
  ])
  const regIds = [...(myRegs ?? []).map((r) => r.id), ...(myTeams ?? []).map((t) => t.registration_id)]
  const { data: wins } = regIds.length
    ? await supabase
        .from("event_results")
        .select("id, title, event:events(title, starts_at, club:clubs(name, faculty_in_charge, hod_name))")
        .in("registration_id", regIds)
        .eq("published", true)
    : { data: [] }

  const studentName = profile?.full_name ?? user.email?.split("@")[0] ?? "Participant"
  const origin = requestOrigin()
  const achievements: CertificateData[] = await Promise.all(
    (wins ?? [])
      .filter((w) => w.event)
      .map((w) =>
        buildCertificate(
          {
            attendanceId: w.id,
            kind: "achievement",
            achievementTitle: w.title,
            studentName,
            eventName: w.event?.title ?? "Event",
            eventDate: w.event?.starts_at ?? new Date().toISOString(),
            clubName: w.event?.club?.name ?? "Club",
            facultyCoordinator: w.event?.club?.faculty_in_charge ?? null,
            hodName: w.event?.club?.hod_name ?? null,
          },
          origin,
        ),
      ),
  )
  const participation: CertificateData[] = await Promise.all(
    (rows ?? [])
      .filter((r) => r.event)
      .map((r) =>
        buildCertificate(
          {
            attendanceId: r.id,
            kind: "participation",
            studentName,
            eventName: r.event?.title ?? "Event",
            eventDate: r.event?.starts_at ?? r.checked_in_at,
            clubName: r.event?.club?.name ?? "Club",
            facultyCoordinator: r.event?.club?.faculty_in_charge ?? null,
            hodName: r.event?.club?.hod_name ?? null,
          },
          origin,
        ),
      ),
  )
  const certificates = [...achievements, ...participation]

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="print:hidden">
        <h1 className="text-2xl font-semibold text-foreground">Certificates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You get a certificate for every event where you were checked in. Each has a QR code anyone can scan to verify it.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          We couldn&apos;t load your certificates. Please refresh.
        </p>
      )}

      {certificates.length > 0 ? (
        <ul className="space-y-10">
          {certificates.map((c) => (
            <li key={`${c.kind}-${c.attendanceId}`}>
              <Certificate data={c} />
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border p-10 text-center">
            <Award className="h-10 w-10 text-muted-foreground" aria-hidden />
            <h2 className="mt-3 text-base font-semibold text-foreground">No certificates yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Register for an event and show your QR ID card at the entrance. Your certificate appears here after you&apos;re
              checked in.
            </p>
            <Button asChild className="mt-5">
              <Link href="/events">Browse events</Link>
            </Button>
          </div>
        )
      )}
    </div>
  )
}
