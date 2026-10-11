import { NextResponse } from "next/server"
import { ApiError, handler } from "@/lib/api"
import { requireServerEnv } from "@/lib/env.server"
import { createAdminClient } from "@/lib/supabase/admin"
import { safeEqual } from "@/lib/payments/server"

/** Marks lapsed memberships as expired. Call with `Authorization: Bearer $CRON_SECRET` (e.g. Vercel Cron). */
export const GET = handler(async (request) => {
  const secret = requireServerEnv("CRON_SECRET")
  const auth = request.headers.get("authorization") ?? ""
  if (!safeEqual(auth, `Bearer ${secret}`)) throw new ApiError(401, "Unauthorized")
  const { data, error } = await createAdminClient().rpc("expire_memberships")
  if (error) throw new ApiError(500, "Could not expire memberships")
  return NextResponse.json({ expired: data })
})
