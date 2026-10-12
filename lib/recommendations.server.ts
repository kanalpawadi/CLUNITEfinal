import "server-only"
import { createClient } from "@/lib/supabase/server"
import { getAuthUser, getProfile } from "@/lib/auth/server"
import { recommendClubs, type Recommendation } from "@/lib/interests"

/** Club recommendations for the signed-in user (clubs are public; memberships read under RLS). */
export async function getClubRecommendations(limit = 6): Promise<{ interests: string[]; recommendations: Recommendation[] }> {
  const [user, profile] = await Promise.all([getAuthUser(), getProfile()])
  const supabase = createClient()

  const [{ data: clubs }, { data: memberships }] = await Promise.all([
    supabase
      .from("clubs")
      .select("id, name, slug, tagline, description, category, college, logo_url, members_count, events_hosted_count")
      .eq("is_active", true)
      .limit(500),
    user
      ? supabase.from("club_memberships").select("club_id").eq("user_id", user.id).in("status", ["active", "pending"])
      : Promise.resolve({ data: [] as { club_id: string }[] }),
  ])

  const interests = profile?.interests ?? []
  return {
    interests,
    recommendations: recommendClubs(clubs ?? [], interests, {
      college: profile?.college,
      excludeClubIds: new Set((memberships ?? []).map((m) => m.club_id)),
      limit,
    }),
  }
}
