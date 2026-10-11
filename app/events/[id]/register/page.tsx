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

export const metadata: Metadata = { title: "Register · Clunite" }

export default async function RegisterPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  const user = await requireAuthUser(`/events/${params.id}/register`)
  const supabase = createClient()

  const [{ data: event }, { data: registration }, profile] = await Promise.all([
    supabase.from("events").select("*, club:clubs(name)").eq("id", params.id).maybeSingle(),
    supabase
      .from("event_registrations")
      .select("id, status, payment_status, created_at, participant_count")
      .eq("event_id", params.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    getProfile(),
  ])
  if (!event) notFound()

  const active = registration && registration.status !== "cancelled"
  const availability = registrationAvailability(event)
  const paid = registration?.payment_status === "paid"

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
              {event.fee > 0 && (
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
      </main>
      <SiteFooter />
    </>
  )
}
