"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase, type User } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/utils"

const httpsUrl = z.union([z.literal(""), z.string().trim().regex(/^https:\/\/\S+$/i, "Links must start with https://").max(300)])
const schema = z.object({
  username: z.union([z.literal(""), z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "3-30 lowercase letters, numbers or _")]),
  headline: z.string().trim().max(120),
  degree: z.string().trim().max(120),
  graduation_year: z.union([z.literal(""), z.string().regex(/^(19[9]\d|20\d\d|2100)$/, "Enter a year like 2027")]),
  skills: z.string().max(800),
  github_url: httpsUrl,
  linkedin_url: httpsUrl,
  portfolio_url: httpsUrl,
  profile_public: z.boolean(),
})
type Fields = z.input<typeof schema>

/** Portfolio fields + public toggle. The public page shows no email or phone. */
export function PortfolioForm({ profile }: { profile: User }) {
  const router = useRouter()
  const [f, setF] = useState<Fields>({
    username: profile.username ?? "",
    headline: profile.headline ?? "",
    degree: profile.degree ?? "",
    graduation_year: profile.graduation_year?.toString() ?? "",
    skills: profile.skills.join(", "),
    github_url: profile.github_url ?? "",
    linkedin_url: profile.linkedin_url ?? "",
    portfolio_url: profile.portfolio_url ?? "",
    profile_public: profile.profile_public,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({})
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setF((x) => ({ ...x, [k]: v }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = schema.safeParse(f)
    if (!parsed.success) {
      const next: typeof errors = {}
      for (const i of parsed.error.issues) next[i.path[0] as keyof Fields] ??= i.message
      return setErrors(next)
    }
    const v = parsed.data
    if (v.profile_public && !v.username) return setErrors({ username: "Pick a username to make your profile public" })
    setErrors({})
    setBusy(true)
    const { error } = await supabase
      .from("users")
      .update({
        username: v.username || null,
        headline: v.headline || null,
        degree: v.degree || null,
        graduation_year: v.graduation_year ? Number(v.graduation_year) : null,
        skills: v.skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 25),
        github_url: v.github_url || null,
        linkedin_url: v.linkedin_url || null,
        portfolio_url: v.portfolio_url || null,
        profile_public: v.profile_public,
      })
      .eq("id", profile.id)
    setBusy(false)
    if (error) {
      if (error.code === "23505") setErrors({ username: "That username is taken" })
      else toast.error(getErrorMessage(error, "Could not save"))
      return
    }
    toast.success("Portfolio saved")
    router.refresh()
  }

  const field = (k: keyof Fields, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`pf-${k}`}>{label}</Label>
      <Input
        id={`pf-${k}`}
        value={String(f[k] ?? "")}
        onChange={(e) => set(k, e.target.value as never)}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `pf-${k}-error` : undefined}
        {...props}
      />
      {errors[k] && (
        <p id={`pf-${k}-error`} className="text-sm text-destructive">
          {errors[k]}
        </p>
      )}
    </div>
  )

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("username", "Username (for your public link)", { placeholder: "asha_k", autoComplete: "off" })}
        {field("headline", "Headline", { placeholder: "Frontend developer · ML enthusiast" })}
        {field("degree", "Degree / programme", { placeholder: "B.Tech Computer Science" })}
        {field("graduation_year", "Graduation year", { inputMode: "numeric", placeholder: "2027" })}
      </div>
      {field("skills", "Skills (comma separated)", { placeholder: "React, Python, Figma" })}
      <div className="grid gap-4 sm:grid-cols-3">
        {field("github_url", "GitHub", { type: "url", placeholder: "https://github.com/…" })}
        {field("linkedin_url", "LinkedIn", { type: "url", placeholder: "https://linkedin.com/in/…" })}
        {field("portfolio_url", "Website", { type: "url", placeholder: "https://…" })}
      </div>
      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" checked={f.profile_public} onChange={(e) => set("profile_public", e.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
        <span>
          Make my portfolio public
          <span className="block text-xs text-muted-foreground">
            Anyone with the link sees your name, photo, headline, skills, links, clubs and achievements. Never your email or phone.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Save portfolio
        </Button>
        {profile.username && (
          <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
            <ExternalLink className="h-4 w-4" aria-hidden /> {profile.profile_public ? "View public page" : "Preview (only you can see it)"}
          </Link>
        )}
      </div>
    </form>
  )
}
