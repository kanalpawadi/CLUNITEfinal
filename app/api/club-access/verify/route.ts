import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, enforceRateLimit, handler, parseJson, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"

const bodySchema = z.object({
  clubId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
})

export const POST = handler(async (request) => {
  const { user } = await requireUser()
  enforceRateLimit("club-otp-verify", user.id, { limit: 10, windowMs: 15 * 60 * 1000 })
  const { clubId, code } = await parseJson(request, bodySchema)
  const admin = createAdminClient()

  const { data: otp } = await admin
    .from("club_access_otps")
    .select("id, expires_at")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("code", code)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!otp) throw new ApiError(400, "Invalid or already used code")

  if (new Date(otp.expires_at) < new Date()) {
    await admin.from("club_access_otps").update({ status: "expired" }).eq("id", otp.id)
    throw new ApiError(400, "Code expired")
  }

  const { error } = await admin
    .from("club_access_otps")
    .update({ status: "used", used_at: new Date().toISOString() })
    .eq("id", otp.id)
    .eq("status", "pending")
  if (error) throw new ApiError(500, "Could not verify the code")
  return NextResponse.json({ success: true })
})
