import { randomInt } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, enforceRateLimit, handler, parseJson, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { codeEmail, sendEmail } from "@/lib/email"

const bodySchema = z.object({ clubId: z.string().uuid() })

/** Emails a 6-digit organizer-access code to the club's OFFICIAL email (never a caller-supplied address). */
export const POST = handler(async (request) => {
  const { supabase, user } = await requireUser()
  enforceRateLimit("club-otp", user.id, { limit: 5, windowMs: 15 * 60 * 1000 })
  const { clubId } = await parseJson(request, bodySchema)

  const { data: isStaff } = await supabase.rpc("is_club_role", {
    club: clubId,
    roles: ["owner", "admin", "organizer"],
  })
  if (!isStaff) throw new ApiError(403, "You are not an organizer of this club")

  const admin = createAdminClient()
  const { data: club } = await admin.from("clubs").select("id, name, official_email, contact_email").eq("id", clubId).single()
  const to = club?.official_email ?? club?.contact_email
  if (!club || !to) throw new ApiError(404, "Club has no official email on file")

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0")
  const { error } = await admin.from("club_access_otps").insert({
    club_id: clubId,
    user_id: user.id,
    code,
    sent_to_email: to,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })
  if (error) throw new ApiError(500, "Could not create a code, please retry")

  const emailed = await sendEmail({
    to,
    subject: `Organizer access code for ${club.name}`,
    html: codeEmail({
      heading: "Organizer access code",
      intro: `Use this code to open the ${club.name} organizer panel. It expires in 10 minutes.`,
      code,
      footer: "If you did not request this code, you can ignore this email.",
    }),
  })

  const maskedEmail = to.replace(/^(.).*(@.*)$/, "$1***$2")
  return NextResponse.json({
    success: true,
    sentTo: maskedEmail,
    emailed,
    ...(process.env.NODE_ENV === "development" && !emailed ? { devCode: code } : {}),
  })
})
