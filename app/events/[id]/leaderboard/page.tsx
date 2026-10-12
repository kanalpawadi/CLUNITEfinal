import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { ArrowLeft, Medal, Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"

export const metadata: Metadata = { title: "Competition leaderboard · Clunite" }

const medal = ["text-warning", "text-muted-foreground", "text-primary"]

export default async function EventLeaderboardPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  const supabase = createClient()
  const [{ data: event }, { data: rows, error }, { data: rounds }] = await Promise.all([
    supabase.from("events").select("id, title, club:clubs(name)").eq("id", params.id).maybeSingle(),
    supabase.rpc("get_event_leaderboard", { p_event_id: params.id }),
    supabase.from("event_rounds").select("round_no, title, results_published").eq("event_id", params.id).order("round_no"),
  ])
  if (!event) notFound()
  const published = (rounds ?? []).filter((r) => r.results_published)

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <Link href={`/events/${event.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to event
        </Link>
        <h1 className="mt-4 flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Trophy className="h-6 w-6 text-primary" aria-hidden /> {event.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {event.club?.name} ·{" "}
          {published.length > 0
            ? `Scores from ${published.map((r) => `Round ${r.round_no}`).join(", ")}`
            : "Scores appear here once the organizers publish round results."}
        </p>

        {error ? (
          <p role="alert" className="mt-8 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            The leaderboard isn&apos;t available. Re-run supabase/schema.sql to enable competitions.
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="sr-only">Competition leaderboard</caption>
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" className="w-16 px-3 py-2 font-medium">Rank</th>
                  <th scope="col" className="px-3 py-2 font-medium">Team / participant</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Rounds cleared</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {(rows ?? []).map((r, i) => (
                  <tr key={`${r.rank}-${r.name}-${i}`} className={r.is_mine ? "bg-primary/5" : undefined} aria-current={r.is_mine ? "true" : undefined}>
                    <td className="px-3 py-2 tabular-nums">
                      {r.rank <= 3 ? <Medal className={`inline h-4 w-4 ${medal[r.rank - 1]}`} aria-label={`Rank ${r.rank}`} /> : `#${r.rank}`}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground">{r.name}</span>
                      {r.is_mine && <span className="ml-1 text-xs text-primary">(you)</span>}
                      {r.result_title && (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{r.result_title}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.rounds_cleared}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{r.total_score}</td>
                  </tr>
                ))}
                {(rows ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No published scores yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
