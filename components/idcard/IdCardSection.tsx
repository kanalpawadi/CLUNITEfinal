import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getProfile, getStaffMemberships, requireAuthUser } from "@/lib/auth/server"
import { effectiveStatus } from "@/lib/membership"
import { IdCard, type CardMembership } from "./IdCard"

/** Server part of the QR ID card: loads the profile and active memberships, renders the live card. */
export async function IdCardSection({ returnPath }: { returnPath: string }) {
  const user = await requireAuthUser(returnPath)
  const [profile, staff] = await Promise.all([getProfile(), getStaffMemberships()])
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
  const canScan = staff.some((s) => ["owner", "admin", "organizer"].includes(s.role))

  return (
    <div className="space-y-6">
      {memberships.length === 0 && (
        <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground print:hidden">
          You don&apos;t have an active club membership yet. Your QR still works for events you&apos;ve registered for.{" "}
          <Link href="/clubs" className="text-primary underline-offset-4 hover:underline">
            Join a club
          </Link>
        </p>
      )}
      <IdCard
        name={profile?.full_name ?? user.email?.split("@")[0] ?? "Member"}
        email={user.email ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        memberships={memberships}
      />
      {canScan && (
        <p className="text-center text-sm text-muted-foreground print:hidden">
          Checking people in at your club&apos;s event?{" "}
          <Link href="/admin/scan" className="font-medium text-primary underline-offset-4 hover:underline">
            Open the scanner
          </Link>
        </p>
      )}
    </div>
  )
}
