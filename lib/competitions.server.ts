import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type Admin = SupabaseClient<Database>

/** The user's active registration for an event: as registrant (team lead) or as a team member. */
export async function findMyRegistration(admin: Admin, eventId: string, userId: string) {
  const { data: lead } = await admin
    .from("event_registrations")
    .select("id, payment_status, status, user_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("status", "registered")
    .maybeSingle()
  if (lead) return lead

  const { data: memberships } = await admin.from("team_members").select("registration_id").eq("user_id", userId)
  if (!memberships?.length) return null
  const { data: team } = await admin
    .from("event_registrations")
    .select("id, payment_status, status, user_id")
    .eq("event_id", eventId)
    .eq("status", "registered")
    .in(
      "id",
      memberships.map((m) => m.registration_id),
    )
    .maybeSingle()
  return team ?? null
}
