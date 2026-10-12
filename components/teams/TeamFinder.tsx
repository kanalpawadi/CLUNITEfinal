"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { Loader2, Mail, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { formatDate } from "@/lib/events"
import { getErrorMessage } from "@/lib/utils"

export type FinderPost = {
  id: string
  kind: "need_team" | "need_members"
  skills: string[]
  message: string
  created_at: string
  author: string
  avatar_url: string | null
  college: string | null
  contact_email: string | null
  is_mine: boolean
}

const postSchema = z.object({
  kind: z.enum(["need_team", "need_members"]),
  message: z.string().trim().min(10, "Write at least 10 characters").max(600),
  skills: z
    .string()
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12))
    .pipe(z.array(z.string().max(30, "Keep each skill under 30 characters"))),
  show_contact: z.boolean(),
})

export function TeamFinder({ eventId, posts }: { eventId: string; posts: FinderPost[] }) {
  const router = useRouter()
  const mine = posts.find((p) => p.is_mine)
  const [filter, setFilter] = useState<"all" | "need_team" | "need_members">("all")
  const [kind, setKind] = useState<FinderPost["kind"]>(mine?.kind ?? "need_team")
  const [message, setMessage] = useState(mine?.message ?? "")
  const [skills, setSkills] = useState(mine?.skills.join(", ") ?? "")
  const [showContact, setShowContact] = useState(!!mine?.contact_email)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = postSchema.safeParse({ kind, message, skills, show_contact: showContact })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid post")
    setError(null)
    setBusy(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setBusy(false)
      return setError("Please sign in again")
    }
    const { error: dbError } = await supabase
      .from("team_finder_posts")
      .upsert({ event_id: eventId, user_id: user.id, ...parsed.data }, { onConflict: "event_id,user_id" })
    setBusy(false)
    if (dbError) setError(getErrorMessage(dbError, "Could not post"))
    else {
      toast.success(mine ? "Post updated" : "Posted to the team board")
      router.refresh()
    }
  }

  const remove = async () => {
    if (!mine) return
    setBusy(true)
    const { error: dbError } = await supabase.from("team_finder_posts").delete().eq("id", mine.id)
    setBusy(false)
    if (dbError) toast.error(getErrorMessage(dbError))
    else {
      setMessage("")
      setSkills("")
      router.refresh()
    }
  }

  const visible = posts.filter((p) => filter === "all" || p.kind === filter)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <section aria-labelledby="board" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="board" className="text-lg font-semibold text-foreground">Posts</h2>
          <div role="group" aria-label="Filter posts" className="flex gap-1 rounded-lg border border-border bg-muted p-1 text-sm">
            {(["all", "need_team", "need_members"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 ${filter === f ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f === "all" ? "All" : f === "need_team" ? "Looking for a team" : "Looking for members"}
              </button>
            ))}
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No posts yet. Be the first!</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((p) => (
              <li key={p.id} className={`rounded-xl border bg-card p-4 shadow-soft ${p.is_mine ? "border-primary/40" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-full border border-border object-cover" />
                    ) : (
                      <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-semibold text-primary">
                        {p.author.charAt(0)}
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-foreground">
                        {p.author} {p.is_mine && <span className="text-xs text-primary">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[p.college, formatDate(p.created_at)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {p.kind === "need_team" ? "Looking for a team" : "Looking for members"}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-foreground">{p.message}</p>
                {p.skills.length > 0 && (
                  <ul aria-label="Skills" className="mt-3 flex flex-wrap gap-1.5">
                    {p.skills.map((s) => (
                      <li key={s} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{s}</li>
                    ))}
                  </ul>
                )}
                {p.contact_email && !p.is_mine && (
                  <a href={`mailto:${p.contact_email}`} className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
                    <Mail className="h-4 w-4" aria-hidden /> {p.contact_email}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="h-fit rounded-xl border border-border bg-card p-5 shadow-soft lg:sticky lg:top-20">
        <h2 className="text-base font-semibold text-foreground">{mine ? "Your post" : "Post on the board"}</h2>
        <form onSubmit={save} noValidate className="mt-4 space-y-3">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">I&apos;m…</legend>
            {(["need_team", "need_members"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm text-foreground">
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="h-4 w-4 accent-primary" />
                {k === "need_team" ? "looking for a team" : "looking for members for my team"}
              </label>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="finder-message">About you / what you need</Label>
            <Textarea id="finder-message" rows={4} maxLength={600} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Frontend dev, free evenings, want to build an AI app…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finder-skills">Skills (comma separated)</Label>
            <Input id="finder-skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Python, UI design" />
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input type="checkbox" checked={showContact} onChange={(e) => setShowContact(e.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
            <span>
              Show my email on this post
              <span className="block text-xs text-muted-foreground">Otherwise people see only your first name and initial.</span>
            </span>
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {mine ? "Update" : "Post"}
            </Button>
            {mine && (
              <Button type="button" variant="ghost" className="text-destructive" onClick={remove} disabled={busy}>
                <Trash2 className="mr-1 h-4 w-4" aria-hidden /> Delete
              </Button>
            )}
          </div>
        </form>
      </aside>
    </div>
  )
}
