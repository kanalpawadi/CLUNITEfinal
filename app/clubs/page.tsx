import type { Metadata } from "next"
import Link from "next/link"
import { Users } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { getAuthUser } from "@/lib/auth/server"
import { getClubRecommendations } from "@/lib/recommendations.server"
import { RecommendedClubs } from "@/components/clubs/RecommendedClubs"

export const metadata: Metadata = {
  title: "Clubs · Clunite",
  description: "Discover campus clubs, their plans and upcoming events.",
}

export default async function ClubsPage() {
  const supabase = createClient()
  const user = await getAuthUser()
  const recs = user ? await getClubRecommendations(3) : null
  const { data: clubs, error } = await supabase
    .from("clubs")
    .select("id, name, slug, tagline, category, college, logo_url, members_count, events_hosted_count")
    .eq("is_active", true)
    .order("members_count", { ascending: false })
    .limit(100)

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto min-h-[70vh] max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-foreground">Clubs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find your people. Sign in to see plans and join.</p>

        {recs && (
          <section aria-labelledby="for-you" className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <h2 id="for-you" className="text-lg font-semibold text-foreground">
                {recs.interests.length > 0 ? "Recommended for you" : "Get personal recommendations"}
              </h2>
              <Link href="/dashboard/student/for-you" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                {recs.interests.length > 0 ? "Edit interests →" : "Pick your interests →"}
              </Link>
            </div>
            {recs.interests.length > 0 ? (
              <RecommendedClubs items={recs.recommendations} />
            ) : (
              <p className="text-sm text-muted-foreground">Tell us what you&apos;re into and we&apos;ll suggest clubs that fit.</p>
            )}
          </section>
        )}

        {error ? (
          <p role="alert" className="mt-10 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            We couldn&apos;t load clubs right now. Please refresh in a moment.
          </p>
        ) : clubs && clubs.length > 0 ? (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club) => (
              <li key={club.id} className="relative flex gap-4 rounded-xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-soft-lg">
                {club.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={club.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover" />
                ) : (
                  <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-primary">
                    {club.name.charAt(0)}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground">
                    <Link href={`/clubs/${club.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {club.name}
                    </Link>
                  </h2>
                  {club.tagline && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{club.tagline}</p>}
                  <p className="mt-2 flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                    <Users className="h-3.5 w-3.5" aria-hidden /> {club.members_count} members · {club.events_hosted_count} events
                    {club.category && ` · ${club.category}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No clubs yet.
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
