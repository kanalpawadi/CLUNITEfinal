import type { Event } from "@/lib/supabase"

export type TeamRange = { min: number; max: number; isTeam: boolean }

/** Members allowed per registration for an event's `team_size`. */
export function teamRange(teamSize: string | null | undefined): TeamRange {
  switch (teamSize) {
    case "2_people":
      return { min: 2, max: 2, isTeam: true }
    case "group_4+":
    case "group_4":
      return { min: 4, max: 8, isTeam: true }
    default:
      return { min: 1, max: 1, isTeam: false }
  }
}

export type RegistrationAvailability =
  | { open: true }
  | { open: false; reason: "not_published" | "ended" | "deadline_passed" | "full"; message: string }

/** Whether new registrations are accepted (mirrors the checks in register_for_event()). */
export function registrationAvailability(
  event: Pick<Event, "status" | "starts_at" | "ends_at" | "registration_deadline" | "capacity" | "current_participants">,
  now: Date = new Date(),
): RegistrationAvailability {
  if (event.status !== "published") {
    return { open: false, reason: "not_published", message: "Registration isn't open for this event." }
  }
  if (now > new Date(event.ends_at ?? event.starts_at)) {
    return { open: false, reason: "ended", message: "This event has already ended." }
  }
  if (event.registration_deadline && now > new Date(event.registration_deadline)) {
    return { open: false, reason: "deadline_passed", message: "The registration deadline has passed." }
  }
  if (event.capacity !== null && event.current_participants >= event.capacity) {
    return { open: false, reason: "full", message: "This event is full." }
  }
  return { open: true }
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })

export function formatMoney(amount: number, currency = "INR"): string {
  if (currency === "INR") return inr.format(amount)
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount)
}

export function formatFee(fee: number): string {
  return fee > 0 ? formatMoney(fee) : "Free"
}

const dateTime = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
})
const dateOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDate = (iso: string) => dateOnly.format(new Date(iso))

export function seatsLeft(event: Pick<Event, "capacity" | "current_participants">): number | null {
  return event.capacity === null ? null : Math.max(0, event.capacity - event.current_participants)
}
