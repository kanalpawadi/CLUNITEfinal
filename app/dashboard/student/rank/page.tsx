import type { Metadata } from "next"
import Link from "next/link"
import { Medal, Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAuthUser } from "@/lib/auth/server"

export const metadata: Metadata = { title: "Leaderboard · Clunite" }

type Tab = "students" | "clubs"
type Period = "all" | "30d"

const medal = ["text-warning", "text-muted-foreground", "text-primary"] // gold, silver, bronze (design tokens)
const medalLabel = ["1st", "2nd", "3rd"]

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  )
}

export default async function LeaderboardPage({ searchParams }: { searchParams: { tab?: string; period?: string } }) {
  await requireAuthUser("/dashboard/student/rank")
  const tab: Tab = searchParams.tab === "clubs" ? "clubs" : "students"
  const period: Period = searchParams.period === "30d" ? "30d" : "all"
  const days = period === "30d" ? 30 : undefined
  const supabase = createClient()
  const href = (t: Tab, p: Period) => `/dashboard/student/rank?tab=${t}&period=${p}`

  const [students, clubs] = await Promise.all([
    tab === "students" ? supabase.rpc("get_student_leaderboard", { p_days: days, p_limit: 50 }) : Promise.resolve(null),
    tab === "clubs" ? supabase.rpc("get_club_leaderboard", { p_days: days, p_limit: 50 }) : Promise.resolve(null),
  ])
  const error = students?.error ?? clubs?.error
  const studentRows = students?.data ?? []
  const clubRows = clubs?.data ?? []
  const me = studentRows.find((r) => r.is_me)

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Trophy className="h-6 w-6 text-primary" aria-hidden /> Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === "students"
              ? "10 points per event attended, 2 per registration, 5 per active club membership."
              : "Ranked by check-ins, events held (×5) and members (×2)."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <nav aria-label="Leaderboard type" className="flex rounded-lg border border-border bg-muted p-1">
            <TabLink href={href("students", period)} active={tab === "students"}>Students</TabLink>
            <TabLink href={href("clubs", period)} active={tab === "clubs"}>Clubs</TabLink>
          </nav>
          <nav aria-label="Time period" className="flex rounded-lg border border-border bg-muted p-1">
            <TabLink href={href(tab, "all")} active={period === "all"}>All time</TabLink>
            <TabLink href={href(tab, "30d")} active={period === "30d"}>30 days</TabLink>
          </nav>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          The leaderboard isn&apos;t available yet. Re-run supabase/schema.sql to add the ranking functions.
        </p>
      )}

      {tab === "students" && !error && (
        <>
          {me && (
            <section aria-label="Your position" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
              <p className="text-sm text-foreground">
                You&apos;re <span className="text-2xl font-semibold tabular-nums text-primary">#{me.rank}</span> with{" "}
                <span className="font-semibold tabular-nums">{me.points}</span> points
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {me.events_attended} attended · {me.registrations} registered · {me.clubs_joined} clubs
              </p>
            </section>
          )}

          {studentRows.filter((r) => r.points > 0).length >= 3 && (
            <ol aria-label="Top three" className="grid gap-4 sm:grid-cols-3">
              {studentRows
                .filter((r) => r.points > 0)
                .slice(0, 3)
                .map((r, i) => (
                  <li key={`${r.rank}-${r.display_name}-${i}`} className={`rounded-xl border bg-card p-4 text-center shadow-soft ${r.is_me ? "border-primary" : "border-border"}`}>
                    <Medal className={`mx-auto h-6 w-6 ${medal[i]}`} aria-label={medalLabel[i]} />
                    {r.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatar_url} alt="" className="mx-auto mt-2 h-14 w-14 rounded-full border border-border object-cover" />
                    ) : (
                      <span aria-hidden className="mx-auto mt-2 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold text-primary">
                        {r.display_name.charAt(0)}
                      </span>
                    )}
                    <p className="mt-2 truncate font-semibold text-foreground">{r.display_name}{r.is_me && " (you)"}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">{r.points} pts</p>
                  </li>
                ))}
            </ol>
          )}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Student ranking</caption>
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" className="w-16 px-3 py-2 font-medium">Rank</th>
                  <th scope="col" className="px-3 py-2 font-medium">Student</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Attended</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Clubs</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {studentRows.map((r, i) => (
                  <tr key={`${r.rank}-${r.display_name}-${i}`} className={r.is_me ? "bg-primary/5" : undefined} aria-current={r.is_me ? "true" : undefined}>
                    <td className="px-3 py-2 tabular-nums">#{r.rank}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground">{r.display_name}</span>
                      {r.is_me && <span className="ml-1 text-xs text-primary">(you)</span>}
                      {r.college && <span className="block text-xs text-muted-foreground">{r.college}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.events_attended}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.clubs_joined}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{r.points}</td>
                  </tr>
                ))}
                {studentRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No points yet. Attend an event to get on the board!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Only first names and initials are shown. You can hide yourself from the leaderboard in your{" "}
            <Link href="/profile" className="text-primary underline-offset-4 hover:underline">profile</Link>.
          </p>
        </>
      )}

      {tab === "clubs" && !error && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">Club ranking</caption>
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="w-16 px-3 py-2 font-medium">Rank</th>
                <th scope="col" className="px-3 py-2 font-medium">Club</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Check-ins</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Events</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Members</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {clubRows.map((c, i) => (
                <tr key={c.club_id}>
                  <td className="px-3 py-2 tabular-nums">
                    {i < 3 && c.points > 0 ? <Medal className={`inline h-4 w-4 ${medal[i]}`} aria-label={medalLabel[i]} /> : `#${c.rank}`}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/clubs/${c.slug}`} className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline">
                      {c.name}
                    </Link>
                    {c.category && <span className="block text-xs text-muted-foreground">{c.category}</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.attendance}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.events}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.members}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{c.points}</td>
                </tr>
              ))}
              {clubRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No clubs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
