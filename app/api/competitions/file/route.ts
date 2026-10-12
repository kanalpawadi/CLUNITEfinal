import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, enforceRateLimit, handler, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

/** Redirects to a 60-second signed URL for a submission file (the team itself or the club's organizers). */
export const GET = handler(async (request) => {
  const { supabase, user } = await requireUser()
  enforceRateLimit("submission-file", user.id, { limit: 60, windowMs: 60_000 })
  const id = z.string().uuid().safeParse(request.nextUrl.searchParams.get("submission"))
  if (!id.success) throw new ApiError(400, "Missing submission")

  // RLS decides visibility: own team's submissions, or the club organizers'
  const { data: submission } = await supabase.from("round_submissions").select("file_path").eq("id", id.data).maybeSingle()
  if (!submission?.file_path) throw new ApiError(404, "File not found")

  const { data, error } = await createAdminClient().storage.from("submissions").createSignedUrl(submission.file_path, 60)
  if (error || !data) throw new ApiError(500, "Could not open the file")
  return NextResponse.redirect(data.signedUrl)
})
