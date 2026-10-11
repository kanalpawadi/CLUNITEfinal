import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, enforceRateLimit, handler, parseJson, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { ensureCredential, issueQrToken } from "@/lib/qr/credentials"
import type { IdCardTokenResponse } from "@/lib/qr/scan-types"

const bodySchema = z.object({ eventId: z.string().uuid().optional() })

/** Issues a short-lived signed QR token for the signed-in user (optionally bound to one event). */
export const POST = handler(async (request) => {
  const { user } = await requireUser()
  enforceRateLimit("qr-token", user.id, { limit: 30, windowMs: 60_000 })
  const { eventId } = await parseJson(request, bodySchema)
  const credential = await ensureCredential(createAdminClient(), user.id)
  if (credential.revoked_at) throw new ApiError(403, "Your ID card has been revoked. Contact a club admin.")
  return NextResponse.json(issueQrToken(credential, eventId) satisfies IdCardTokenResponse)
})
