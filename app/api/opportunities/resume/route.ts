import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, enforceRateLimit, handler, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

/** 60-second signed link to an applicant's résumé: the applicant or the posting club's owner/admin. */
export const GET = handler(async (request) => {
  const { supabase, user } = await requireUser()
  enforceRateLimit("resume-download", user.id, { limit: 60, windowMs: 60_000 })
  const id = z.string().uuid().safeParse(request.nextUrl.searchParams.get("application"))
  if (!id.success) throw new ApiError(400, "Missing application")

  // RLS: own application, or staff of the posting club
  const { data: app } = await supabase.from("opportunity_applications").select("resume_path").eq("id", id.data).maybeSingle()
  if (!app?.resume_path) throw new ApiError(404, "Résumé not found")

  const { data, error } = await createAdminClient().storage.from("resumes").createSignedUrl(app.resume_path, 60)
  if (error || !data) throw new ApiError(500, "Could not open the résumé")
  return NextResponse.redirect(data.signedUrl)
})
