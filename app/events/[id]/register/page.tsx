import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getProfile, requireAuthUser } from "@/lib/auth/server"
import { formatDateTime, formatFee, registrationAvailability, teamRange } from "@/lib/events"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { RegisterForm } from "@/components/events/RegisterForm"
import { EventPaymentPanel } from "@/components/payments/EventPaymentPanel"
import { CompetitionPanel } from "@/components/competitions/CompetitionPanel"
import { TeamPanel } from "@/components/teams/TeamPanel"
import { parseQuestions } from "@/lib/questions"

export const metadata: Metadata = { title: "Register · Clunite" }

export default async function RegisterPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  const user = await requireAuthUser(`/events/${params.id}/register`)
  const supabase = createClient()

  const REG_FIELDS = "id, status, payment_status, created_at, participant_count, team_name, invite_code, event_id"
  const [{ data: event }, { data: ownRegistration }, { data: teamRows }, profile] = await Promise.all([
    supabase.from("events").select("*, club:clubs(name)").eq("id", params.id).maybeSingle(),
    supabase.from("event_registrations").select(REG_FIELDS).eq("event_id", params.id).eq("user_id", user.id).maybeSingle(),
    // Team membership via an invite (RLS: members can see their team's registration)
    supabase.from("team_members").select(`registration:event_registrations(${REG_FIELDS})`).eq("user_id", user.id),
    getProfile(),
  ])
  if (!event) notFound()

  const teamRegistration = (teamRows ?? []).map((t) => t.registration).find((r) => r?.event_id === params.id && r.status !== "cancelled")
  const registration = ownRegistration && ownRegistration.status !== "cancelled" ? ownRegistration : (teamRegistration ?? ownRegistration)
  const isLead = !!registration && registration.id === ownRegistration?.id
  const capacity = teamRange(event.team_size).max

  const active = registration && registration.status !== "cancelled"
  const availability = registrationAvailability(event)
  const paid = registration?.payment_status === "paid"

  // Competition rounds (RLS: rounds of published events; own team's submissions only)
  const { data: rounds } = await supabase.from("event_rounds").select("*").eq("event_id", event.id).order("round_no")
  const { data: roster } =
    active && capacity > 1 ? await supabase.rpc("get_team_roster", { p_registration_id: registration.id }) : { data: null }
  const { data: announcements } = active
    ? await supabase.from("event_announcements").select("id, title, body, created_at").eq("event_id", event.id).order("created_at", { ascending: false }).limit(10)
    : { data: null }
  const { data: mySubmissions } =
    active && rounds && rounds.length > 0
      ? await supabase.from("round_submissions").select("*").eq("registration_id", registration.id)
      : { data: [] }

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <Link href={`/events/${event.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to event
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">{event.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDateTime(event.starts_at)} · {event.venue ?? "Venue TBA"} ·{" "}
          <span className="tabular-nums">{formatFee(event.fee)}</span>
        </p>

        <div className="mt-8 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
          {active ? (
            <div className="space-y-4">
              <p className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                {event.fee > 0 && !paid ? "Registered. One step left: payment." : "You're registered."}
              </p>
              <p className="text-sm text-muted-foreground">
                Registered on {formatDateTime(registration.created_at)}
                {registration.participant_count > 1 && ` · team of ${registration.participant_count}`}.
                {registration.status === "waitlisted" && " You're on the waitlist."}
              </p>
              {event.fee > 0 && !isLead && !paid && (
                <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  Your team lead pays the registration fee. Submissions unlock once it&apos;s paid.
                </p>
              )}
              {event.fee > 0 && isLead && (
                <EventPaymentPanel
                  eventId={event.id}
                  amount={event.fee}
                  paid={paid}
                  email={user.email ?? ""}
                  name={profile?.full_name ?? ""}
                />
              )}
              <p className="text-sm text-muted-foreground">
                Show your{" "}
                <Link href="/profile/id-card" className="font-medium text-primary underline-offset-4 hover:underline">
                  QR ID card
                </Link>{" "}
                at the entrance for check-in.
              </p>
            </div>
          ) : availability.open ? (
            <>
              <h2 className="mb-4 text-lg font-semibold text-foreground">Your registration</h2>
              <RegisterForm
                eventId={event.id}
                team={teamRange(event.team_size)}
                questions={parseQuestions(event.registration_questions)}
                defaults={{
                  name: profile?.full_name ?? "",
                  email: user.email ?? profile?.email ?? "",
                  phone: profile?.phone ?? "",
                  college: profile?.college ?? "",
                  branch: profile?.branch ?? "",
                }}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{availability.message}</p>
          )}
        </div>

        {announcements && announcements.length > 0 && (
          <section aria-labelledby="updates" className="mt-8 space-y-3">
            <h2 id="updates" className="text-lg font-semibold text-foreground">Updates from the organizers</h2>
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-medium text-foreground">{a.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-2 text-xs tabular-nums text-muted-foreground">{formatDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {active && capacity > 1 && (
          <div className="mt-8">
            <TeamPanel
              eventId={event.id}
              registrationId={registration.id}
              teamName={registration.team_name}
              inviteCode={isLead ? registration.invite_code : null}
              isLead={isLead}
              roster={roster ?? []}
              capacity={capacity}
            />
          </div>
        )}

        {active && rounds && rounds.length > 0 && (
          <div className="mt-8">
            <CompetitionPanel
              rounds={rounds}
              submissions={mySubmissions ?? []}
              blockedReason={event.fee > 0 && !paid ? "Complete your payment above to unlock submissions." : undefined}
            />
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
