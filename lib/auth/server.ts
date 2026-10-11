import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { loginUrl } from "@/lib/auth/redirect"
import type { Club, User as Profile } from "@/lib/supabase"
import type { Enums } from "@/types/database"

/** The verified signed-in user for this request (deduplicated per render). */
export const getAuthUser = cache(async () => {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getAuthUser()
  if (!user) return null
  const supabase = createClient()
  const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle()
  return data
})

/** Current path, forwarded by middleware as `x-pathname`, for login round-trips. */
function currentPath(fallback: string) {
  return headers().get("x-pathname") ?? fallback
}

/** Server-component guard: returns the user or redirects to /login?redirectTo=<path>. */
export async function requireAuthUser(pathForRedirect?: string) {
  const user = await getAuthUser()
  if (!user) redirect(loginUrl(pathForRedirect ?? currentPath("/dashboard"), "auth_required"))
  return user
}

export type StaffMembership = {
  club_id: string
  role: Enums<"club_role">
  club: Pick<Club, "id" | "name" | "slug" | "logo_url">
}

/** Clubs where the user is active staff (owner/admin/organizer/treasurer). Read under RLS. */
export const getStaffMemberships = cache(async (): Promise<StaffMembership[]> => {
  const user = await getAuthUser()
  if (!user) return []
  const supabase = createClient()
  const { data } = await supabase
    .from("club_memberships")
    .select("club_id, role, club:clubs(id, name, slug, logo_url)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "admin", "organizer", "treasurer"])
  return (data ?? []).flatMap((m) => (m.club ? [{ club_id: m.club_id, role: m.role, club: m.club }] : []))
})

export async function isSuperAdmin(): Promise<boolean> {
  const profile = await getProfile()
  return profile?.global_role === "super_admin"
}

/** Server-side role check for one club (mirrors the RLS helper). */
export async function hasClubRole(clubId: string, roles: Enums<"club_role">[]): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase.rpc("is_club_role", { club: clubId, roles })
  return data === true
}
