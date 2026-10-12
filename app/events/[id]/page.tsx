import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Ticket, Trophy, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getAuthUser } from "@/lib/auth/server"
import { formatDateTime, formatFee, getEventImageUrl, registrationAvailability, seatsLeft, teamRange } from "@/lib/events"
import { roundState } from "@/lib/competitions"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { Button } from "@/components/ui/button"

type Props = { params: { id: string } }

const idSchema = z.string().uuid()

async function loadEvent(id: string) {
  if (!idSchema.safeParse(id).success) return null
  const supabase = createClient()
  const { data } = await supabase
    .from("events")
    .select("*, club:clubs(id, name, slug, logo_url)")
    .eq("id", id)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await loadEvent(params.id)
  return event ? { title: `${event.title} · Clunite`, description: event.description?.slice(0, 160) } : { title: "Event · Clunite" }
}

export default async function EventDetailPage({ params }: Props) {
  const event = await loadEvent(params.id)
  if (!event) notFound()

  const supabase = createClient()
  const user = await getAuthUser()
  const [registration] = await Promise.all([
    user
      ? supabase
          .from("event_registrations")
          .select("status, payment_status")
          .eq("event_id", event.id)
          .eq("user_id", user.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    supabase.rpc("increment_event_views", { p_event_id: event.id }),
  ])

  const availability = registrationAvailability(event)
  const [{ data: rounds }, { data: results }] = await Promise.all([
    supabase.from("event_rounds").select("id, round_no, title, starts_at, ends_at, results_published").eq("event_id", event.id).order("round_no"),
    supabase.from("event_results").select("id, position, title, registration_id").eq("event_id", event.id).eq("published", true).order("position"),
  ])
  const { data: board } = results && results.length > 0 ? await supabase.rpc("get_event_leaderboard", { p_event_id: event.id }) : { data: null }
  const left = seatsLeft(event)
  const team = teamRange(event.team_size)
  const isRegistered = registration && registration.status !== "cancelled"
  const needsPayment = isRegistered && event.fee > 0 && registration.payment_status !== "paid"

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All events
        </Link>

        {/* Event Banner */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getEventImageUrl(event.image_url, event.category, event.title)}
          alt={event.title}
          className="mt-6 aspect-[16/6] w-full rounded-xl border border-border object-cover shadow-soft"
        />

        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_280px]">
          <div>
            {event.category && <p className="font-mono text-xs uppercase tracking-wider text-primary">{event.category}</p>}
            <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">{event.title}</h1>
            {event.club && <p className="mt-2 text-sm text-muted-foreground">Hosted by {event.club.name}</p>}
            {event.description && (
              <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-foreground">{event.description}</div>
            )}
            {event.requirements && event.requirements.length > 0 && (
              <section className="mt-8">
                <h2 className="text-sm font-semibold text-foreground">What to bring</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {event.requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
            )}

            {rounds && rounds.length > 0 && (
              <section aria-labelledby="stages" className="mt-8">
                <div className="flex items-end justify-between gap-2">
                  <h2 id="stages" className="text-sm font-semibold text-foreground">Stages</h2>
                  <Link href={`/events/${event.id}/leaderboard`} className="text-sm text-primary underline-offset-4 hover:underline">
                    Leaderboard →
                  </Link>
                </div>
                <ol className="mt-3 space-y-2 border-l border-border pl-4">
                  {rounds.map((r) => {
                    const state = roundState(r)
                    return (
                      <li key={r.id} className="relative text-sm">
                        <span aria-hidden className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${state === "open" ? "bg-success" : state === "closed" ? "bg-muted-foreground" : "bg-border"}`} />
                        <p className="font-medium text-foreground">
                          Round {r.round_no}: {r.title}
                          <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">{state}</span>
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {formatDateTime(r.starts_at)} → {formatDateTime(r.ends_at)}
                        </p>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}

            {results && results.length > 0 && (
              <section aria-labelledby="winners" className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <h2 id="winners" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Trophy className="h-4 w-4 text-primary" aria-hidden /> Results
                </h2>
                <ol className="mt-2 space-y-1 text-sm">
                  {results.map((res) => {
                    const row = board?.find((b) => b.result_title === res.title)
                    return (
                      <li key={res.id} className="flex justify-between gap-2">
                        <span className="text-foreground">
                          <span className="tabular-nums text-muted-foreground">#{res.position}</span> {res.title}
                        </span>
                        <span className="font-medium text-foreground">{row?.name ?? "—"}</span>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}
          </div>

          <aside className="h-fit rounded-xl border border-border bg-card p-5 shadow-soft md:sticky md:top-20">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{formatFee(event.fee)}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <time dateTime={event.starts_at}>{formatDateTime(event.starts_at)}</time>
              </li>
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {event.mode === "online" ? "Online" : (event.venue ?? "Venue TBA")}
              </li>
              <li className="flex gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="tabular-nums">
                  {team.isTeam ? `Teams of ${team.min === team.max ? team.min : `${team.min}-${team.max}`}` : "Individual"}
                  {left !== null && ` · ${left} seats left`}
                </span>
              </li>
              {event.registration_deadline && (
                <li className="flex gap-2">
                  <Ticket className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Register by {formatDateTime(event.registration_deadline)}
                </li>
              )}
            </ul>

            <div className="mt-5">
              {isRegistered ? (
                <>
                  <p className="flex items-center gap-2 text-sm font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    {needsPayment ? "Registered · payment pending" : "You're registered"}
                  </p>
                  <Button asChild className="mt-3 w-full" variant={needsPayment ? "default" : "outline"}>
                    <Link href={`/events/${event.id}/register`}>{needsPayment ? "Complete payment" : "View registration"}</Link>
                  </Button>
                </>
              ) : availability.open ? (
                <Button asChild className="w-full">
                  {/* Middleware sends visitors to /login?redirectTo=… and back here afterwards */}
                  <Link href={`/events/${event.id}/register`}>Register{event.fee > 0 ? ` · ${formatFee(event.fee)}` : ""}</Link>
                </Button>
              ) : (
                <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">{availability.message}</p>
              )}
              {!user && availability.open && (
                <p className="mt-2 text-xs text-muted-foreground">You&apos;ll be asked to sign in or create an account.</p>
              )}
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
