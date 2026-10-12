import type { Metadata } from "next"
import { CheckCircle2, ShieldX } from "lucide-react"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireServerEnv } from "@/lib/env.server"
import { verifyCertificateToken } from "@/lib/certificates/token"
import { certificateNumber } from "@/lib/certificates/server"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"

export const metadata: Metadata = { title: "Verify certificate · Clunite", robots: { index: false } }

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })

/**
 * Public verification page reached by scanning a certificate's QR.
 * Valid only if the signature matches AND the attendance record still exists.
 * Shows just what is printed on the certificate (no email, phone or other data).
 */
export default async function VerifyCertificatePage({ params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token)
  const check = verifyCertificateToken(token, requireServerEnv("QR_SIGNING_SECRET"))

  let record: {
    certificateNo: string
    kind: "participation" | "achievement"
    title: string | null
    student: string
    event: string
    date: string
    club: string
    faculty: string | null
    hod: string | null
  } | null = null

  if (check.ok) {
    const admin = createAdminClient()
    if ("aid" in check.ref) {
      const { data } = await admin
        .from("attendance")
        .select("id, user:users!attendance_user_id_fkey(full_name), event:events(title, starts_at, club:clubs(name, faculty_in_charge, hod_name))")
        .eq("id", check.ref.aid)
        .maybeSingle()
      if (data?.event) {
        record = {
          certificateNo: certificateNumber(data.id),
          kind: "participation",
          title: null,
          student: data.user?.full_name ?? "Participant",
          event: data.event.title,
          date: data.event.starts_at,
          club: data.event.club?.name ?? "—",
          faculty: data.event.club?.faculty_in_charge ?? null,
          hod: data.event.club?.hod_name ?? null,
        }
      }
    } else {
      const { data } = await admin
        .from("event_results")
        .select(
          "id, title, published, registration:event_registrations(team_name, user:users!event_registrations_user_id_fkey(full_name)), event:events(title, starts_at, club:clubs(name, faculty_in_charge, hod_name))",
        )
        .eq("id", check.ref.rid)
        .maybeSingle()
      if (data?.published && data.event) {
        record = {
          certificateNo: certificateNumber(data.id),
          kind: "achievement",
          title: data.title,
          student: data.registration?.user?.full_name ?? data.registration?.team_name ?? "Participant",
          event: data.event.title,
          date: data.event.starts_at,
          club: data.event.club?.name ?? "—",
          faculty: data.event.club?.faculty_in_charge ?? null,
          hod: data.event.club?.hod_name ?? null,
        }
      }
    }
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4 py-12">
        {record ? (
          <section className="rounded-xl border border-success/40 bg-card p-6 shadow-soft">
            <p className="flex items-center gap-2 text-lg font-semibold text-success">
              <CheckCircle2 className="h-6 w-6" aria-hidden /> Valid certificate
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Issued by Clunite from verified event attendance.</p>
            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Certificate No.</dt>
              <dd className="font-mono text-foreground">{record.certificateNo}</dd>
              <dt className="text-muted-foreground">Student</dt>
              <dd className="font-semibold text-foreground">{record.student}</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="text-foreground">{record.kind === "achievement" ? `Achievement: ${record.title}` : "Participation"}</dd>
              <dt className="text-muted-foreground">Event</dt>
              <dd className="text-foreground">{record.event}</dd>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="text-foreground">{dateFmt.format(new Date(record.date))}</dd>
              <dt className="text-muted-foreground">Organised by</dt>
              <dd className="text-foreground">{record.club}</dd>
              <dt className="text-muted-foreground">Faculty Coordinator</dt>
              <dd className="text-foreground">{record.faculty ?? "—"}</dd>
              <dt className="text-muted-foreground">Head of Department</dt>
              <dd className="text-foreground">{record.hod ?? "—"}</dd>
            </dl>
          </section>
        ) : (
          <section role="alert" className="rounded-xl border border-destructive/40 bg-card p-6 shadow-soft">
            <p className="flex items-center gap-2 text-lg font-semibold text-destructive">
              <ShieldX className="h-6 w-6" aria-hidden /> Not a valid certificate
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This code was not issued by Clunite, has been altered, or the record behind it no longer exists.
            </p>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
