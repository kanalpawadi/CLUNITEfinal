import { NextResponse } from "next/server"
import { ApiError, enforceRateLimit, handler, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { ensureCredential, issueQrToken } from "@/lib/qr/credentials"

/**
 * Regenerates the user's QR: bumps token_version, which invalidates every previously issued token
 * (screenshots, shared images) immediately, then returns a fresh one.
 */
export const POST = handler(async () => {
  const { user } = await requireUser()
  enforceRateLimit("qr-regenerate", user.id, { limit: 5, windowMs: 60 * 60 * 1000 })
  const admin = createAdminClient()
  const current = await ensureCredential(admin, user.id)
  if (current.revoked_at) throw new ApiError(403, "Your ID card has been revoked. Contact a club admin.")

  const { data: updated, error } = await admin
    .from("id_credentials")
    .update({ token_version: current.token_version + 1, issued_at: new Date().toISOString() })
    .eq("id", current.id)
    .eq("token_version", current.token_version) // optimistic lock
    .select("*")
    .maybeSingle()
  if (error || !updated) throw new ApiError(409, "Your card changed in another tab. Please try again.")
  return NextResponse.json(issueQrToken(updated))
})
