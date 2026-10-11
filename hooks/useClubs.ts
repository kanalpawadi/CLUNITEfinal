"use client"

import { useState, useEffect } from "react"
import { supabase, type Club, type Event } from "@/lib/supabase"

export function useClubs() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchClubs()
  }, [])

  const fetchClubs = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase.from("clubs").select("*").order("name", { ascending: true })

      if (error) throw error

      setClubs(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return { clubs, loading, error, refetch: fetchClubs }
}

export function useClub(clubId: string) {
  const [club, setClub] = useState<Club | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clubId) return

    fetchClubData()
  }, [clubId])

  const fetchClubData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch club details
      const { data: clubData, error: clubError } = await supabase.from("clubs").select("*").eq("id", clubId).single()

      if (clubError) throw clubError

      // Fetch club events
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .eq("club_id", clubId)
        .eq("status", "published")
        .order("starts_at", { ascending: true })

      if (eventsError) throw eventsError

      setClub(clubData)
      setEvents(eventsData || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return { club, events, loading, error, refetch: fetchClubData }
}

export function useUserClubs(userId: string) {
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    fetchUserClubs()
  }, [userId])

  const fetchUserClubs = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from("club_memberships")
        .select(`
          club:clubs(*)
        `)
        .eq("user_id", userId)

      if (error) throw error

      const userClubs = data?.map((membership) => membership.club).filter(Boolean) || []
      setClubs(userClubs as Club[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return { clubs, loading, error, refetch: fetchUserClubs }
}

/**
 * Join a club on its Free plan. Active immediately unless the club requires approval
 * (then pending until an admin approves). Paid plans go through /api/payments.
 * Returns the resulting membership status.
 */
export async function joinClubInstant(userId: string, clubId: string): Promise<"active" | "pending"> {
  if (!userId || !clubId) {
    throw new Error("Missing userId or clubId")
  }

  const [{ data: club, error: clubError }, { data: freePlan, error: planError }] = await Promise.all([
    supabase.from("clubs").select("requires_approval").eq("id", clubId).single(),
    supabase.from("membership_plans").select("id").eq("club_id", clubId).eq("tier", "free").eq("is_active", true).maybeSingle(),
  ])
  if (clubError) throw clubError
  if (planError) throw planError

  const status = club.requires_approval || !freePlan ? "pending" : "active"
  const { error: membershipError } = await supabase
    .from("club_memberships")
    .insert({ user_id: userId, club_id: clubId, plan_id: freePlan?.id ?? null, status, role: "member" })

  // 23505 = already a member: joining is idempotent
  if (membershipError && membershipError.code !== "23505") {
    throw membershipError
  }
  return status
}

/**
 * Remove user from a club by deleting membership.
 */
export async function leaveClubInstant(userId: string, clubId: string) {
  if (!userId || !clubId) {
    throw new Error("Missing userId or clubId")
  }

  const { error } = await supabase
    .from("club_memberships")
    .delete()
    .eq("user_id", userId)
    .eq("club_id", clubId)

  if (error) {
    throw error
  }
}
