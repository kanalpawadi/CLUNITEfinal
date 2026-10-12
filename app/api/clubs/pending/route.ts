import { randomInt } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, enforceRateLimit, handler, parseJson, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { codeEmail, sendEmail } from "@/lib/email"

const text = (max: number) => z.string().trim().max(max)

const bodySchema = z.object({
  official_email: z.string().trim().toLowerCase().email().max(254),
  president_name: text(120).optional().default(""),
  president_email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(254)]).optional().default(""),
  president_phone: text(40).optional().default(""),
  club: z.object({
    name: text(120).min(2),
    tagline: text(200).optional().default(""),
    description: text(5000).optional().default(""),
    vision: text(5000).optional().default(""),
    category: text(60).min(1),
    college: text(200).optional().default(""),
    founding_date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default(""),
    faculty_in_charge: text(200).optional().default(""),
    hod_name: text(200).optional().default(""),
  }),
})

const PIN_TTL_HOURS = 48

/** Creates a pending club and emails an 8-digit PIN to the official address. The PIN never reaches the browser. */
export const POST = handler(async (request) => {
  const { user } = await requireUser()
  enforceRateLimit("pending-club", user.id, { limit: 5, windowMs: 60 * 60 * 1000 })
  const body = await parseJson(request, bodySchema)
  const admin = createAdminClient()

  const clubData = {
    ...body.club,
    founding_date: body.club.founding_date || null,
    contact_email: body.official_email,
  }

  // Retry on the (official_email, pin) unique constraint
  let created: { id: string; pin: string } | null = null
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const pin = randomInt(0, 100_000_000).toString().padStart(8, "0")
    const { data, error } = await admin
      .from("pending_clubs")
      .insert({
        pin,
        official_email: body.official_email,
        president_name: body.president_name || null,
        president_email: body.president_email || null,
        president_phone: body.president_phone || null,
        created_by: user.id,
        expires_at: new Date(Date.now() + PIN_TTL_HOURS * 3600_000).toISOString(),
        club_data: clubData,
      })
      .select("id, pin")
      .single()
    if (data) created = data
    else if (error && error.code !== "23505") throw new ApiError(500, "Could not save the club request")
  }
  if (!created) throw new ApiError(500, "Could not generate a unique PIN, please retry")

  const emailed = await sendEmail({
    to: body.official_email,
    subject: `Your club verification PIN: ${body.club.name}`,
    html: codeEmail({
      heading: "Verify your club on Clunite",
      intro: `Use this PIN to finish creating "${body.club.name}". It expires in ${PIN_TTL_HOURS} hours.`,
      code: created.pin,
      footer: "If you did not request this, you can ignore this email.",
    }),
  })

  return NextResponse.json({
    id: created.id,
    emailed,
    // Local development only, so the flow is testable without an email provider
    ...(process.env.NODE_ENV === "development" && !emailed ? { devPin: created.pin } : {}),
  })
})
