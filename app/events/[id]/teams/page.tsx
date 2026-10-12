import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { ArrowLeft, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAuthUser } from "@/lib/auth/server"
import { teamRange } from "@/lib/events"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { TeamFinder } from "@/components/teams/TeamFinder"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Team board · Clunite" }

export default async function TeamBoardPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  await requireAuthUser(`/events/${params.id}/teams`)
  const supabase = createClient()
  const [{ data: event }, { data: posts, error }] = await Promise.all([
    supabase.from("events").select("id, title, team_size").eq("id", params.id).maybeSingle(),
    supabase.rpc("get_team_finder_posts", { p_event_id: params.id }),
  ])
  if (!event) notFound()
  const team = teamRange(event.team_size)

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-10">
        <Link href={`/events/${event.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to event
        </Link>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
              <Users className="h-6 w-6 text-primary" aria-hidden /> Find teammates
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {event.title} ·{" "}
              {team.isTeam ? `teams of ${team.min === team.max ? team.min : `${team.min}–${team.max}`}` : "individual event"}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/teams/join">I have an invite code</Link>
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-8 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            The team board isn&apos;t available yet. Re-run supabase/schema.sql to enable teams.
          </p>
        ) : (
          <div className="mt-8">
            <TeamFinder eventId={event.id} posts={posts ?? []} />
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
