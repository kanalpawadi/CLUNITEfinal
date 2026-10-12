import type { Metadata } from "next"
import { getProfile, requireAuthUser } from "@/lib/auth/server"
import { getClubRecommendations } from "@/lib/recommendations.server"
import { InterestPicker } from "@/components/interests/InterestPicker"
import { RecommendedClubs } from "@/components/clubs/RecommendedClubs"

export const metadata: Metadata = { title: "For you · Clunite" }

export default async function ForYouPage() {
  const user = await requireAuthUser("/dashboard/student/for-you")
  const [profile, { interests, recommendations }] = await Promise.all([getProfile(), getClubRecommendations(9)])

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Clubs for you</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick what you&apos;re into and we&apos;ll match you with clubs.</p>
      </header>

      <section aria-labelledby="interests-h" className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <h2 id="interests-h" className="mb-4 text-base font-semibold text-foreground">
          Your interests
        </h2>
        <InterestPicker userId={user.id} initial={profile?.interests ?? []} />
      </section>

      <section aria-labelledby="recs-h" className="space-y-4">
        <h2 id="recs-h" className="text-lg font-semibold text-foreground">
          {interests.length > 0 ? "Recommended clubs" : "Popular clubs"}
        </h2>
        {interests.length === 0 && (
          <p className="text-sm text-muted-foreground">Select a few interests above to get personal recommendations.</p>
        )}
        <RecommendedClubs items={recommendations} emptyText="You've joined every club we'd suggest. Nice!" />
      </section>
    </div>
  )
}
