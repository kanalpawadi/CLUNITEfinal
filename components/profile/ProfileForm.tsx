"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase, type User } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/utils"

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z.union([z.literal(""), z.string().trim().regex(/^[+\d][\d\s-]{6,19}$/, "Enter a valid phone number")]),
  gender: z.string().trim().max(50),
  college: z.string().trim().max(200),
  branch: z.string().trim().max(120),
  bio: z.string().trim().max(500),
})
type Fields = z.infer<typeof schema>

const AVATAR_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }

export function ProfileForm({ profile }: { profile: User }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fields, setFields] = useState<Fields>({
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    gender: profile.gender ?? "",
    college: profile.college ?? "",
    branch: profile.branch ?? "",
    bio: profile.bio ?? "",
  })
  const [avatar, setAvatar] = useState(profile.avatar_url)
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }))

  const onSave = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const parsed = schema.safeParse(fields)
    if (!parsed.success) {
      const next: typeof errors = {}
      for (const i of parsed.error.issues) next[i.path[0] as keyof Fields] ??= i.message
      setErrors(next)
      return
    }
    setErrors({})
    setSaving(true)
    const v = parsed.data
    const { error } = await supabase
      .from("users")
      .update({
        full_name: v.full_name,
        phone: v.phone || null,
        gender: v.gender || null,
        college: v.college || null,
        branch: v.branch || null,
        bio: v.bio || null,
      })
      .eq("id", profile.id)
    setSaving(false)
    if (error) toast.error(getErrorMessage(error, "Could not save your profile"))
    else {
      toast.success("Profile saved")
      router.refresh()
    }
  }

  const onAvatar = async (file: File | undefined) => {
    if (!file) return
    const ext = AVATAR_TYPES[file.type]
    if (!ext) return toast.error("Use a JPEG, PNG or WebP image")
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB")
    setUploading(true)
    try {
      // Storage policy only allows writes under avatars/<your user id>/
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path)
      const { error } = await supabase.from("users").update({ avatar_url: publicUrl }).eq("id", profile.id)
      if (error) throw error
      setAvatar(publicUrl)
      toast.success("Photo updated")
      router.refresh()
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const err = (k: keyof Fields) =>
    errors[k] ? (
      <p id={`${k}-error`} className="text-sm text-destructive">
        {errors[k]}
      </p>
    ) : null

  return (
    <form onSubmit={onSave} noValidate className="space-y-6">
      <div className="flex items-center gap-4">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="Your profile photo" className="h-20 w-20 rounded-full border border-border object-cover" />
        ) : (
          <span aria-hidden className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl font-semibold text-primary">
            {(fields.full_name || profile.email).charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <input ref={fileRef} id="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onAvatar(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Camera className="mr-2 h-4 w-4" aria-hidden />}
            Change photo
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">Shown on your ID card. JPEG, PNG or WebP, max 5MB.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" value={fields.full_name} onChange={set("full_name")} aria-invalid={!!errors.full_name} aria-describedby={errors.full_name ? "full_name-error" : undefined} />
          {err("full_name")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={profile.email} readOnly aria-readonly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" value={fields.phone} onChange={set("phone")} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined} />
          {err("phone")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender</Label>
          <Input id="gender" value={fields.gender} onChange={set("gender")} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="college">College</Label>
          <Input id="college" value={fields.college} onChange={set("college")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="branch">Branch</Label>
          <Input id="branch" value={fields.branch} onChange={set("branch")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" rows={3} value={fields.bio} onChange={set("bio")} maxLength={500} />
      </div>
      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
        Save profile
      </Button>
    </form>
  )
}
