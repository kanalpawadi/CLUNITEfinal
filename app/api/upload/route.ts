import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, enforceRateLimit, handler, requireUser } from "@/lib/api"
import { createAdminClient } from "@/lib/supabase/admin"

// Public name -> storage bucket. Legacy names kept for existing callers.
const BUCKETS = {
  "Club Banner": "club-banners",
  "Event Banner": "event-banners",
  "club-banners": "club-banners",
  "event-banners": "event-banners",
  "club-logos": "club-logos",
  avatars: "avatars",
} as const

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const

const MAX_BYTES = 10 * 1024 * 1024

const bucketSchema = z.enum(Object.keys(BUCKETS) as [keyof typeof BUCKETS, ...(keyof typeof BUCKETS)[]])

/** Authenticated image upload. Files are stored under <bucket>/<user id>/<uuid>.<ext>. */
export const POST = handler(async (request) => {
  const { user } = await requireUser()
  enforceRateLimit("upload", user.id, { limit: 20, windowMs: 10 * 60 * 1000 })

  const form = await request.formData().catch(() => {
    throw new ApiError(400, "Expected multipart form data")
  })
  const file = form.get("file")
  if (!(file instanceof File)) throw new ApiError(400, "No file provided")

  const bucketResult = bucketSchema.safeParse(form.get("bucket") ?? "Club Banner")
  if (!bucketResult.success) throw new ApiError(400, "Invalid bucket")
  const bucket = BUCKETS[bucketResult.data]

  const type = file.type.toLowerCase()
  if (!(type in IMAGE_TYPES)) throw new ApiError(400, "Please upload a JPEG, PNG, WebP or GIF image")
  if (file.size > MAX_BYTES) throw new ApiError(400, "File too large. Maximum size is 10MB.")

  const ext = IMAGE_TYPES[type as keyof typeof IMAGE_TYPES]
  const path = `${user.id}/${randomUUID()}.${ext}`
  const admin = createAdminClient()

  const { error } = await admin.storage
    .from(bucket)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: type, cacheControl: "3600", upsert: false })
  if (error) throw new ApiError(500, "Upload failed. Please try again.")

  const {
    data: { publicUrl },
  } = admin.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ url: publicUrl, path, size: file.size, type })
})
