import Link from "next/link"
import { BarChart3, CalendarCheck2, CreditCard, QrCode, ShieldCheck, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { EventCard } from "@/components/events/EventCard"
import { Button } from "@/components/ui/button"

const features = [
  {
    icon: Users,
    title: "Clubs & memberships",
    body: "Free, Standard, Premium and Lifetime plans for every club, with approvals, renewals and roles built in.",
  },
  {
    icon: CalendarCheck2,
    title: "Events in a few clicks",
    body: "Publish events with capacity, deadlines and team sizes. Members register in seconds.",
  },
  {
    icon: CreditCard,
    title: "Payments that reconcile",
    body: "Paid events and plans go through Razorpay. Every payment lands in the club's income ledger.",
  },
  {
    icon: QrCode,
    title: "QR member ID",
    body: "A signed, short-lived QR on every member's phone. No personal data inside the code.",
  },
  {
    icon: BarChart3,
    title: "Attendance & analytics",
    body: "Scan at the door, see who showed up, and track registrations, revenue and engagement.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Row-level security on every table: members see their own data, staff see their club's.",
  },
]

const steps = [
  { cmd: "signup", text: "Create your account with email, a magic link or Google." },
  { cmd: "join --club", text: "Join a club on its free plan, or pick a paid plan." },
  { cmd: "register --event", text: "Register for events and pay securely if there's a fee." },
  { cmd: "checkin --qr", text: "Show your QR ID card at the entrance and you're in." },
]

export default async function LandingPage() {
  const supabase = createClient()
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, venue, fee, capacity, current_participants, category, image_url, mode, club:clubs(name, slug)")
    .eq("status", "published")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(3)

  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 md:grid-cols-[1.1fr_1fr] md:pt-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-primary">campus clubs · events · check-in</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
              Run your club like it&apos;s already organised.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Clunite brings memberships, event registration, payments and QR check-in into one calm place for students and
              the clubs they love.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/events">Explore events</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/signup">Create an account</Link>
              </Button>
            </div>
          </div>

          <div aria-hidden className="rounded-xl border border-border bg-card shadow-soft-lg">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-brand" />
              <span className="ml-3 text-xs text-muted-foreground">~/clunite</span>
            </div>
            <pre className="overflow-x-auto whitespace-pre p-5 text-[13px] leading-7 text-foreground">
              <span className="text-muted-foreground">$</span> clunite join <span className="text-primary">--club</span> robotics{"\n"}
              <span className="text-success">✓</span> member CLB-7QK2PX · plan: standard{"\n"}
              <span className="text-muted-foreground">$</span> clunite register <span className="text-primary">--event</span> hackathon{"\n"}
              <span className="text-success">✓</span> paid ₹199 · receipt RCPT-0042{"\n"}
              <span className="text-muted-foreground">$</span> clunite checkin <span className="text-primary">--qr</span>{"\n"}
              <span className="text-success">✓</span> welcome in, see you at the venue
              <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-brand" />
            </pre>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features" className="border-t border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 id="features" className="text-xl font-semibold text-foreground sm:text-2xl">
              Everything a club needs
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-xl border border-border bg-background p-5">
                  <Icon className="h-5 w-5 text-primary" aria-hidden />
                  <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="how" className="text-xl font-semibold text-foreground sm:text-2xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.cmd} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <p className="text-xs tabular-nums text-muted-foreground">0{i + 1}</p>
                <p className="mt-2 font-medium text-primary">› {step.cmd}</p>
                <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Upcoming events */}
        {events && events.length > 0 && (
          <section aria-labelledby="upcoming" className="border-t border-border bg-card">
            <div className="mx-auto max-w-6xl px-4 py-16">
              <div className="flex items-end justify-between gap-4">
                <h2 id="upcoming" className="text-xl font-semibold text-foreground sm:text-2xl">
                  Happening soon
                </h2>
                <Link href="/events" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                  All events →
                </Link>
              </div>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <div key={event.id} className="flex flex-col gap-3">
                    <EventCard event={event} />
                    <Button asChild variant="outline" size="sm">
                      {/* Visitors are sent to sign in first, then straight back to this registration */}
                      <Link href={`/events/${event.id}/register`} aria-label={`Register for ${event.title}`}>
                        Register
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Ready when your club is.</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            Sign up free, join a club and grab your member ID. Starting a club? Create it from your dashboard.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/clubs">Browse clubs</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
