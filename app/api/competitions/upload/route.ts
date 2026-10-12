import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, enforceRateLimit, handler, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { findMyRegistration } from "@/lib/competitions.server"
import { SUBMISSION_FILE_TYPES, SUBMISSION_MAX_BYTES, roundState } from "@/lib/competitions"

/**
 * Uploads a round submission file to the private `submissions` bucket at
 * <event id>/<registration id>/<uuid>.<ext>. The client then calls submit_round_entry(p_file_path),
 * which re-checks eligibility, timing and that the path belongs to this registration.
 */
export const POST = handler(async (request) => {
  const { user } = await requireUser()
  enforceRateLimit("submission-upload", user.id, { limit: 10, windowMs: 10 * 60 * 1000 })

  const form = await request.formData().catch(() => {
    throw new ApiError(400, "Expected multipart form data")
  })
  const roundId = z.string().uuid().safeParse(form.get("roundId"))
  const file = form.get("file")
  if (!roundId.success) throw new ApiError(400, "Missing round")
  if (!(file instanceof File)) throw new ApiError(400, "No file provided")
  const ext = SUBMISSION_FILE_TYPES[file.type]
  if (!ext) throw new ApiError(400, "Upload a PDF, ZIP, PPTX, PNG or JPEG file")
  if (file.size > SUBMISSION_MAX_BYTES) throw new ApiError(400, "File too large (max 20MB)")

  const admin = createAdminClient()
  const { data: round } = await admin
    .from("event_rounds")
    .select("id, event_id, starts_at, ends_at, submission_type")
    .eq("id", roundId.data)
    .maybeSingle()
  if (!round || round.submission_type !== "file") throw new ApiError(404, "This round doesn't accept files")
  if (roundState(round) !== "open") throw new ApiError(409, "This round is not open")

  const registration = await findMyRegistration(admin, round.event_id, user.id)
  if (!registration) throw new ApiError(403, "Register for this competition first")

  const path = `${round.event_id}/${registration.id}/${randomUUID()}.${ext}`
  const { error } = await admin.storage
    .from("submissions")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (error) throw new ApiError(500, "Upload failed. Please try again.")
  return NextResponse.json({ path })
})
