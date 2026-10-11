import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getProfile, requireAuthUser } from "@/lib/auth/server"
import { effectiveStatus } from "@/lib/membership"
import { SiteHeader } from "@/components/site/SiteHeader"
import { IdCard, type CardMembership } from "@/components/idcard/IdCard"

export const metadata: Metadata = { title: "ID card · Clunite" }

export default async function IdCardPage() {
  const user = await requireAuthUser("/profile/id-card")
  const profile = await getProfile()
  const supabase = createClient()
  const { data: rows } = await supabase
    .from("club_memberships")
    .select("club_id, role, status, member_code, expires_at, club:clubs(name), plan:membership_plans(name, tier)")
    .eq("user_id", user.id)
    .order("joined_at")

  const memberships: CardMembership[] = (rows ?? [])
    .filter((m) => effectiveStatus(m) === "active")
    .map((m) => ({
      clubId: m.club_id,
      clubName: m.club?.name ?? "Club",
      role: m.role,
      plan: m.plan?.name ?? null,
      tier: m.plan?.tier ?? null,
      memberCode: m.member_code,
      expiresAt: m.expires_at,
    }))

  return (
    <>
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Profile
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-foreground print:hidden">Your ID card</h1>
        <p className="mt-1 text-sm text-muted-foreground print:hidden">
          Show this at event entrances. Staff scan the QR to check you in.
        </p>
        {memberships.length === 0 && (
          <p className="mt-4 rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground print:hidden">
            You don&apos;t have an active club membership yet. Your QR still works for events you&apos;ve registered for.{" "}
            <Link href="/clubs" className="text-primary underline-offset-4 hover:underline">
              Join a club
            </Link>
          </p>
        )}
        <div className="mt-8">
          <IdCard
            name={profile?.full_name ?? user.email?.split("@")[0] ?? "Member"}
            email={user.email ?? ""}
            avatarUrl={profile?.avatar_url ?? null}
            memberships={memberships}
          />
        </div>
      </main>
    </>
  )
}
