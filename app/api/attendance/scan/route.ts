import { NextResponse } from "next/server"
import { ApiError, enforceRateLimit, handler, parseJson, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyScannedToken } from "@/lib/qr/credentials"
import { scanRequestSchema, type ScanAttendee, type ScanOutcome, type ScanResponse } from "@/lib/qr/scan-types"
import { effectiveStatus } from "@/lib/membership"
import { findMyRegistration } from "@/lib/competitions.server"

const MESSAGES: Record<ScanOutcome, string> = {
  checked_in: "Checked in. Welcome!",
  already_checked_in: "Already checked in.",
  invalid: "Invalid QR code. It may be tampered with or not a Clunite ID.",
  expired: "This QR code has expired. Ask them to refresh their ID card.",
  revoked: "This QR code was revoked. Ask them to open their latest ID card.",
  wrong_event: "This pass is for a different event.",
  not_registered: "Not registered for this event.",
  unpaid: "Registered, but the event fee hasn't been paid.",
  membership_inactive: "Their club membership is suspended.",
}

const respond = (outcome: ScanOutcome, extra: Omit<ScanResponse, "outcome" | "message"> = {}) =>
  NextResponse.json({ outcome, message: MESSAGES[outcome], ...extra } satisfies ScanResponse)

/**
 * Verifies a member's QR and records attendance once.
 * Order: signature → expiry → event binding → credential version/revocation → scanner's role →
 * registration → payment (paid events) → membership standing → insert (unique per event+user).
 */
export const POST = handler(async (request) => {
  const { supabase, user: scanner } = await requireUser()
  enforceRateLimit("scan", scanner.id, { limit: 60, windowMs: 60_000 })
  const { token, eventId } = await parseJson(request, scanRequestSchema)
  const admin = createAdminClient()

  // Authorisation first, so non-staff learn nothing about tokens.
  const { data: event } = await admin.from("events").select("id, club_id, fee, status").eq("id", eventId).maybeSingle()
  if (!event) throw new ApiError(404, "Event not found")
  const { data: isStaff } = await supabase.rpc("is_club_role", { club: event.club_id, roles: ["owner", "admin", "organizer"] })
  if (!isStaff) throw new ApiError(403, "Only this club's owner, admins and organizers can scan for this event")

  const verified = verifyScannedToken(token)
  if (!verified.ok) return respond(verified.reason === "expired" ? "expired" : "invalid")
  const { uid, cid, v, eid } = verified.payload
  if (eid && eid !== eventId) return respond("wrong_event")

  const { data: credential } = await admin
    .from("id_credentials")
    .select("id, user_id, token_version, revoked_at")
    .eq("id", cid)
    .maybeSingle()
  if (!credential || credential.user_id !== uid) return respond("invalid")
  if (credential.revoked_at || credential.token_version !== v) return respond("revoked")

  const [{ data: profile }, { data: membership }, { data: registration }] = await Promise.all([
    admin.from("users").select("full_name, email, avatar_url").eq("id", uid).maybeSingle(),
    admin
      .from("club_memberships")
      .select("status, expires_at, member_code, plan:membership_plans(name)")
      .eq("club_id", event.club_id)
      .eq("user_id", uid)
      .maybeSingle(),
    findMyRegistration(admin, eventId, uid).then((data) => ({ data })),
  ])

  // Minimal identity for the door: name, photo, member code, plan.
  const attendee: ScanAttendee = {
    name: profile?.full_name ?? profile?.email?.split("@")[0] ?? "Member",
    avatarUrl: profile?.avatar_url ?? null,
    memberCode: membership?.member_code ?? null,
    plan: membership?.plan?.name ?? null,
  }

  if (!registration || registration.status !== "registered") return respond("not_registered", { attendee })
  if (event.fee > 0 && registration.payment_status !== "paid") return respond("unpaid", { attendee })
  if (membership && ["suspended", "expired"].includes(effectiveStatus(membership))) {
    return respond("membership_inactive", { attendee })
  }

  const { data: inserted, error } = await admin
    .from("attendance")
    .insert({ event_id: eventId, user_id: uid, checked_in_by: scanner.id })
    .select("checked_in_at")
    .maybeSingle()

  const countAttendance = async () =>
    (await admin.from("attendance").select("id", { count: "exact", head: true }).eq("event_id", eventId)).count ?? undefined

  if (error?.code === "23505") {
    const { data: existing } = await admin
      .from("attendance")
      .select("checked_in_at")
      .eq("event_id", eventId)
      .eq("user_id", uid)
      .maybeSingle()
    return respond("already_checked_in", { attendee, checkedInAt: existing?.checked_in_at, attendanceCount: await countAttendance() })
  }
  if (error || !inserted) throw new ApiError(500, "Could not record attendance. Try again.")

  return respond("checked_in", { attendee, checkedInAt: inserted.checked_in_at, attendanceCount: await countAttendance() })
})
