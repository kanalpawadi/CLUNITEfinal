import type { Metadata } from "next"
import Link from "next/link"
import { IdCard } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getProfile, requireAuthUser } from "@/lib/auth/server"
import { formatDate } from "@/lib/events"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { ProfileForm } from "@/components/profile/ProfileForm"
import { LeaderboardToggle } from "@/components/profile/LeaderboardToggle"
import { PortfolioForm } from "@/components/profile/PortfolioForm"
import { InterestPicker } from "@/components/interests/InterestPicker"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Profile · Clunite" }

export default async function ProfilePage() {
  const user = await requireAuthUser("/profile")
  const profile = await getProfile()
  const supabase = createClient()
  const { data: memberships } = await supabase
    .from("club_memberships")
    .select("id, role, status, member_code, expires_at, club:clubs(name, slug), plan:membership_plans(name, tier)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Your profile</h1>
          <Button asChild variant="outline">
            <Link href="/profile/id-card">
              <IdCard className="mr-2 h-4 w-4" aria-hidden /> My ID card
            </Link>
          </Button>
        </div>

        <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
          {profile ? (
            <ProfileForm profile={profile} />
          ) : (
            <p role="alert" className="text-sm text-destructive">
              Your profile is still being created. Refresh in a moment.
            </p>
          )}
        </section>

        {profile && (
          <section aria-labelledby="portfolio" className="mt-10 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
            <h2 id="portfolio" className="text-lg font-semibold text-foreground">
              Portfolio
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Your public profile for recruiters and organizers, with achievements filled in automatically.
            </p>
            <PortfolioForm profile={profile} />
          </section>
        )}

        {profile && (
          <section aria-labelledby="interests" className="mt-10 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
            <h2 id="interests" className="text-lg font-semibold text-foreground">
              Interests
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Used to recommend clubs.{" "}
              <Link href="/dashboard/student/for-you" className="text-primary underline-offset-4 hover:underline">
                See your recommendations
              </Link>
            </p>
            <InterestPicker userId={profile.id} initial={profile.interests} compact />
            <div className="mt-6 border-t border-border pt-5">
              <LeaderboardToggle userId={profile.id} initial={profile.show_on_leaderboard} />
            </div>
          </section>
        )}

        <section aria-labelledby="memberships" className="mt-10">
          <h2 id="memberships" className="text-lg font-semibold text-foreground">
            Memberships
          </h2>
          {memberships && memberships.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Club</th>
                    <th scope="col" className="px-4 py-2 font-medium">Plan</th>
                    <th scope="col" className="px-4 py-2 font-medium">Role</th>
                    <th scope="col" className="px-4 py-2 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2 font-medium">Member code</th>
                    <th scope="col" className="px-4 py-2 font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {memberships.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2">
                        {m.club ? (
                          <Link href={`/clubs/${m.club.slug}`} className="text-primary underline-offset-4 hover:underline">
                            {m.club.name}
                          </Link>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="px-4 py-2">{m.plan?.name ?? "–"}</td>
                      <td className="px-4 py-2 capitalize">{m.role}</td>
                      <td className="px-4 py-2 capitalize">{m.status}</td>
                      <td className="px-4 py-2 font-mono tabular-nums">{m.member_code ?? "–"}</td>
                      <td className="px-4 py-2 tabular-nums">{m.expires_at ? formatDate(m.expires_at) : "Never"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              You haven&apos;t joined a club yet.{" "}
              <Link href="/clubs" className="text-primary underline-offset-4 hover:underline">
                Browse clubs
              </Link>
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
