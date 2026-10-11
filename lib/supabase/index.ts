import type { Tables } from "@/types/database"
import { createClient } from "./client"

/**
 * Browser Supabase client used by existing client components.
 * Server code must use `@/lib/supabase/server` (user-scoped) or `@/lib/supabase/admin` (service role).
 */
export const supabase = createClient()

export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from "@/types/database"

// Convenience row types
export type User = Tables<"users">
export type Club = Tables<"clubs">
export type Event = Tables<"events"> & { club?: Club | null }
export type ClubMembership = Tables<"club_memberships">
export type MembershipPlan = Tables<"membership_plans">
export type EventRegistration = Tables<"event_registrations">
export type EventExpense = Tables<"event_expenses">
export type Payment = Tables<"payments">
export type IdCredential = Tables<"id_credentials">
export type Attendance = Tables<"attendance">
export type ClubAccessOtp = Tables<"club_access_otps">
