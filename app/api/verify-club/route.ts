import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, enforceRateLimit, handler, parseJson, requireUser } from "@/lib/api"

const bodySchema = z.object({
  pendingClubId: z.string().uuid(),
  pin: z.string().regex(/^\d{8}$/, "PIN must be 8 digits"),
  bannerUrl: z.string().url().max(2048).nullable().optional(),
})

/** Verifies the PIN and creates the club; the caller (from the session) becomes the owner. */
export const POST = handler(async (request) => {
  const { supabase, user } = await requireUser()
  enforceRateLimit("verify-club", user.id, { limit: 10, windowMs: 15 * 60 * 1000 })
  const { pendingClubId, pin, bannerUrl } = await parseJson(request, bodySchema)

  const { data: club, error } = await supabase.rpc("verify_and_create_club", {
    p_pending_club_id: pendingClubId,
    p_pin: pin,
    p_banner_url: bannerUrl ?? undefined,
  })
  if (error) throw new ApiError(400, error.message || "Failed to verify and create club")
  if (!club || !club.id) throw new ApiError(400, "Invalid PIN", "invalid_pin")
  return NextResponse.json({ success: true, club })
})
