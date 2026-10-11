"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase, type Club, type Event, type User } from "@/lib/supabase"
import { STAFF_ROLES, type Enums } from "@/types/database"
import { parseRegistrationData, type RegistrationData } from "@/lib/registration-data"

export type ParticipantStatus = Enums<"registration_status"> | "attended"

type ParticipantUser = Pick<User, "id" | "full_name" | "email" | "college" | "phone" | "avatar_url">

export interface EventParticipant {
  /** registration id, or `<registration id>_member_<n>` for expanded team members */
  id: string
  registration_id: string
  user_id: string
  status: ParticipantStatus
  payment_status: Enums<"payment_status"> | null
  team_name: string | null
  registered_at: string
  registration_data: RegistrationData
  user: ParticipantUser | null
}

export interface ParticipantStats {
  total: number
  registered: number
  waitlisted: number
  cancelled: number
  attended: number
}

const emptyStats = (): ParticipantStats => ({ total: 0, registered: 0, waitlisted: 0, cancelled: 0, attended: 0 })

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "An error occurred")

const baseRegistrationId = (participantId: string) => participantId.split("_member_")[0]

export function useEventParticipants(eventId: string) {
  const [participants, setParticipants] = useState<EventParticipant[]>([])
  const [eventDetails, setEventDetails] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchParticipants = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (!eventId) {
        setParticipants([])
        setEventDetails(null)
        return
      }

      const { data: eventData, error: eventError } = await supabase.from("events").select("*").eq("id", eventId).single()
      if (eventError) throw eventError
      setEventDetails(eventData)

      const [{ data, error: fetchError }, { data: attendance, error: attendanceError }] = await Promise.all([
        supabase
          .from("event_registrations")
          .select("*, user:users!event_registrations_user_id_fkey(id, full_name, email, college, phone, avatar_url)")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false }),
        supabase.from("attendance").select("user_id").eq("event_id", eventId),
      ])
      if (fetchError) throw fetchError
      if (attendanceError) throw attendanceError

      const attended = new Set((attendance ?? []).map((a) => a.user_id))
      const expanded: EventParticipant[] = []

      for (const registration of data ?? []) {
        const regData = parseRegistrationData(registration.registration_data)
        const status: ParticipantStatus =
          registration.status === "registered" && attended.has(registration.user_id) ? "attended" : registration.status
        const base: EventParticipant = {
          id: registration.id,
          registration_id: registration.id,
          user_id: registration.user_id,
          status,
          payment_status: registration.payment_status,
          team_name: registration.team_name,
          registered_at: registration.created_at,
          registration_data: regData,
          user: registration.user,
        }

        if (regData.team_members && regData.team_members.length > 0) {
          regData.team_members.forEach((member, index) => {
            expanded.push({
              ...base,
              id: `${registration.id}_member_${index}`,
              user: {
                id: `virtual_${registration.id}_${index}`,
                full_name: member.name,
                email: member.email,
                college: member.college ?? null,
                phone: member.phone ?? null,
                avatar_url: index === 0 ? (registration.user?.avatar_url ?? null) : null,
              },
            })
          })
        } else {
          expanded.push(base)
        }
      }

      setParticipants(expanded)
    } catch (err) {
      console.error("Error fetching event participants:", err)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void fetchParticipants()
  }, [fetchParticipants])

  const getParticipantsByStatus = (status: ParticipantStatus) => participants.filter((p) => p.status === status)

  const getParticipantStats = (): ParticipantStats => ({
    total: participants.length,
    registered: getParticipantsByStatus("registered").length,
    waitlisted: getParticipantsByStatus("waitlisted").length,
    cancelled: getParticipantsByStatus("cancelled").length,
    attended: getParticipantsByStatus("attended").length,
  })

  /** "attended" writes to the attendance table; other statuses update the registration. */
  const updateParticipantStatus = async (participantId: string, newStatus: ParticipantStatus) => {
    try {
      const registrationId = baseRegistrationId(participantId)
      const target = participants.find((p) => p.registration_id === registrationId)
      if (!target) throw new Error("Participant not found")

      if (newStatus === "attended") {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const { error } = await supabase
          .from("attendance")
          .upsert(
            { event_id: eventId, user_id: target.user_id, checked_in_by: user?.id ?? null },
            { onConflict: "event_id,user_id", ignoreDuplicates: true },
          )
        if (error) throw error
      } else {
        const { error: removeError } = await supabase
          .from("attendance")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", target.user_id)
        if (removeError) throw removeError
        const { error } = await supabase.from("event_registrations").update({ status: newStatus }).eq("id", registrationId)
        if (error) throw error
      }

      setParticipants((prev) => prev.map((p) => (p.registration_id === registrationId ? { ...p, status: newStatus } : p)))
      return { success: true as const }
    } catch (err) {
      console.error("Error updating participant status:", err)
      return { success: false as const, error: errorMessage(err) }
    }
  }

  return {
    participants,
    eventDetails,
    loading,
    error,
    refetch: fetchParticipants,
    getParticipantsByStatus,
    getParticipantStats,
    updateParticipantStatus,
  }
}

export type OrganizerEvent = Event & {
  club: Club | null
  participantStats: ParticipantStats
  hasParticipants: boolean
}

export function useOrganizerEvents(userId?: string) {
  const [events, setEvents] = useState<OrganizerEvent[]>([])
  const [userClubs, setUserClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrganizerEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let currentUserId = userId
      if (!currentUserId) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error("User not authenticated")
        currentUserId = user.id
      }

      // Clubs where the user holds a staff role
      const { data: memberships, error: membershipsError } = await supabase
        .from("club_memberships")
        .select("club:clubs(*)")
        .eq("user_id", currentUserId)
        .eq("status", "active")
        .in("role", [...STAFF_ROLES])
      if (membershipsError) throw membershipsError

      const clubs = (memberships ?? []).map((m) => m.club).filter((c): c is Club => c !== null)
      const uniqueClubs = Array.from(new Map(clubs.map((club) => [club.id, club])).values())
      setUserClubs(uniqueClubs)

      if (uniqueClubs.length === 0) {
        setEvents([])
        return
      }

      const { data: eventRows, error: eventsError } = await supabase
        .from("events")
        .select("*, club:clubs(*), event_registrations(status, participant_count, user_id), attendance(user_id)")
        .in(
          "club_id",
          uniqueClubs.map((c) => c.id),
        )
        .order("created_at", { ascending: false })
      if (eventsError) throw eventsError

      setEvents(
        (eventRows ?? []).map(({ event_registrations, attendance, ...event }) => {
          const attended = new Set(attendance.map((a) => a.user_id))
          const stats = emptyStats()
          for (const reg of event_registrations) {
            const n = reg.participant_count
            stats.total += n
            if (reg.status === "registered" && attended.has(reg.user_id)) stats.attended += n
            else stats[reg.status] += n
          }
          return { ...event, participantStats: stats, hasParticipants: stats.total > 0 }
        }),
      )
    } catch (err) {
      console.error("Error fetching organizer events:", err)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void fetchOrganizerEvents()
  }, [fetchOrganizerEvents])

  return { events, userClubs, loading, error, refetch: fetchOrganizerEvents }
}

export function useParticipantsSummary(eventIds: string[]) {
  const [summary, setSummary] = useState({
    totalParticipants: 0,
    registeredCount: 0,
    attendedCount: 0,
    waitlistedCount: 0,
    cancelledCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const key = JSON.stringify(eventIds)

  const fetchSummary = useCallback(async () => {
    const ids = JSON.parse(key) as string[]
    try {
      setLoading(true)
      setError(null)
      if (ids.length === 0) {
        setSummary({ totalParticipants: 0, registeredCount: 0, attendedCount: 0, waitlistedCount: 0, cancelledCount: 0 })
        return
      }

      const [{ data, error: fetchError }, { count: attendedCount, error: attendanceError }] = await Promise.all([
        supabase.from("event_registrations").select("status, participant_count").in("event_id", ids),
        supabase.from("attendance").select("id", { count: "exact", head: true }).in("event_id", ids),
      ])
      if (fetchError) throw fetchError
      if (attendanceError) throw attendanceError

      const counts = emptyStats()
      for (const r of data ?? []) {
        counts.total += r.participant_count
        counts[r.status] += r.participant_count
      }
      setSummary({
        totalParticipants: counts.total,
        registeredCount: counts.registered,
        attendedCount: attendedCount ?? 0,
        waitlistedCount: counts.waitlisted,
        cancelledCount: counts.cancelled,
      })
    } catch (err) {
      console.error("Error fetching participants summary:", err)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  return { summary, loading, error, refetch: fetchSummary }
}

