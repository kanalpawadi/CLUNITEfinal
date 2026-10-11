/**
 * Profile helpers.
 * public.users rows are created by the `handle_new_user` database trigger on sign-up,
 * so the client only ever READS its own profile here.
 */

import type { User as AuthUser } from "@supabase/supabase-js"
import { supabase, type User } from "./supabase"

/** Confirms the signed-in user's profile row exists (created by the DB trigger). */
export async function ensureUserExists(
  authUser: AuthUser,
): Promise<{ success: true; data: User } | { success: false; error: string }> {
  const profile = await getUserFromDatabase(authUser.id)
  return profile ? { success: true, data: profile } : { success: false, error: "Profile not found" }
}

export async function userExistsInDatabase(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("users").select("id").eq("id", userId).maybeSingle()
  return !error && !!data
}

export async function getUserFromDatabase(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle()
  if (error) {
    console.error("Error fetching user profile:", error.message)
    return null
  }
  return data
}
