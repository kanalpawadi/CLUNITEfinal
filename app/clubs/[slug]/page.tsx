import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { ArrowLeft, Mail, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAuthUser } from "@/lib/auth/server"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { EventCard } from "@/components/events/EventCard"
import { MembershipPanel } from "@/components/membership/MembershipPanel"

type Props = { params: { slug: string } }

const slugSchema = z.string().regex(/^[a-z0-9-]{1,120}$/)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `${params.slug.replace(/-/g, " ")} · Clunite` }
}

export default async function ClubPage({ params }: Props) {
  if (!slugSchema.safeParse(params.slug).success) notFound()
  const user = await requireAuthUser(`/clubs/${params.slug}`)
  const supabase = createClient()

  const { data: club } = await supabase.from("clubs").select("*").eq("slug", params.slug).maybeSingle()
  if (!club) notFound()

  const [{ data: plans }, { data: membership }, { data: events }] = await Promise.all([
    supabase.from("membership_plans").select("*").eq("club_id", club.id).eq("is_active", true).order("price"),
    supabase.from("club_memberships").select("*").eq("club_id", club.id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("events")
      .select("id, title, starts_at, venue, fee, capacity, current_participants, category, image_url, mode, club:clubs(name, slug)")
      .eq("club_id", club.id)
      .eq("status", "published")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(6),
  ])

  const isStaff = membership?.status === "active" && ["owner", "admin", "organizer", "treasurer"].includes(membership.role)

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-10">
        <Link href="/clubs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All clubs
        </Link>

        <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          {club.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.logo_url} alt="" className="h-16 w-16 rounded-xl border border-border object-cover" />
          ) : (
            <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-2xl font-semibold text-primary">
              {club.name.charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-foreground">{club.name}</h1>
            {club.tagline && <p className="text-sm text-muted-foreground">{club.tagline}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden /> {club.members_count} members
              </span>
              {club.category && <span>{club.category}</span>}
              {club.college && <span>{club.college}</span>}
              {club.contact_email && (
                <a href={`mailto:${club.contact_email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Mail className="h-3.5 w-3.5" aria-hidden /> {club.contact_email}
                </a>
              )}
            </p>
          </div>
          {isStaff && (
            <Link href={`/admin/clubs/${club.id}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Manage club
            </Link>
          )}
        </header>

        {club.description && <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-foreground">{club.description}</p>}

        <section aria-labelledby="membership" className="mt-10">
          <h2 id="membership" className="text-lg font-semibold text-foreground">
            Membership
          </h2>
          <MembershipPanel
            club={{ id: club.id, name: club.name, requires_approval: club.requires_approval }}
            plans={plans ?? []}
            membership={membership}
            user={{ email: user.email ?? "" }}
          />
        </section>

        <section aria-labelledby="upcoming" className="mt-12">
          <h2 id="upcoming" className="text-lg font-semibold text-foreground">
            Upcoming events
          </h2>
          {events && events.length > 0 ? (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No upcoming events.</p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
