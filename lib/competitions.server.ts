import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type Admin = SupabaseClient<Database>

/** The caller's active registration for an event (as the registrant / team lead). */
export async function findMyRegistration(admin: Admin, eventId: string, userId: string) {
  const { data } = await admin
    .from("event_registrations")
    .select("id, payment_status, status")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("status", "registered")
    .maybeSingle()
  return data
}
