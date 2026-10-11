import { z } from "zod"

export const scanRequestSchema = z.object({
  token: z.string().trim().min(10).max(1024),
  eventId: z.string().uuid(),
})

export type ScanOutcome =
  | "checked_in"
  | "already_checked_in"
  | "invalid"
  | "expired"
  | "revoked"
  | "wrong_event"
  | "not_registered"
  | "unpaid"
  | "membership_inactive"

export type ScanAttendee = {
  name: string
  avatarUrl: string | null
  memberCode: string | null
  plan: string | null
}

export type ScanResponse = {
  outcome: ScanOutcome
  message: string
  attendee?: ScanAttendee
  checkedInAt?: string
  attendanceCount?: number
}

export const SCAN_OK: ReadonlySet<ScanOutcome> = new Set(["checked_in"])
export const SCAN_WARN: ReadonlySet<ScanOutcome> = new Set(["already_checked_in"])

export type IdCardTokenResponse = { token: string; exp: number; version: number }
