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

/**
 * Returns a high-resolution, theme-harmonised image for events.
 * Falls back to tailored visuals based on the event's category and title.
 */
export function getEventImageUrl(
  imageUrl: string | null | undefined,
  category: string | null | undefined,
  title?: string,
): string {
  if (imageUrl && imageUrl.trim().length > 0 && !imageUrl.includes("placeholder.svg")) {
    return imageUrl
  }

  const cat = (category || "").toLowerCase()
  const t = (title || "").toLowerCase()

  // Coding, hackathons, open source, tech workshops
  if (cat.includes("tech") || cat.includes("code") || t.includes("hack") || t.includes("git") || t.includes("web") || t.includes("dev")) {
    return "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80"
  }

  // Robotics, AI, hardware, engineering
  if (cat.includes("robot") || t.includes("robot") || t.includes("ai") || t.includes("machine") || cat.includes("engine")) {
    return "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80"
  }

  // Design, UX/UI, arts, creative
  if (cat.includes("design") || cat.includes("art") || t.includes("ui") || t.includes("creative") || t.includes("figma")) {
    return "https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=1200&q=80"
  }

  // Cultural, music, drama, dance, fest
  if (cat.includes("cultur") || cat.includes("music") || t.includes("fest") || t.includes("dance") || t.includes("stage")) {
    return "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80"
  }

  // Sports, games, athletic meets
  if (cat.includes("sport") || t.includes("cricket") || t.includes("badminton") || t.includes("tourn") || t.includes("esport")) {
    return "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80"
  }

  // Business, entrepreneurship, summit, conference
  if (cat.includes("business") || cat.includes("manage") || t.includes("summit") || t.includes("talk") || t.includes("meetup")) {
    return "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1200&q=80"
  }

  // Default campus innovation & student collaboration
  return "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80"
}

