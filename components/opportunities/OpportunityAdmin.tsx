"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { ExternalLink, FileDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { APPLICATION_STATUS, type Application, type Opportunity } from "@/lib/opportunities"
import { getErrorMessage } from "@/lib/utils"

const formSchema = z.object({
  kind: z.enum(["internship", "job"]),
  title: z.string().trim().min(3, "Title is too short").max(140),
  company: z.string().trim().min(2, "Company is required").max(140),
  location: z.string().trim().max(140),
  mode: z.enum(["remote", "onsite", "hybrid"]),
  stipend: z.string().trim().max(80),
  description: z.string().trim().min(20, "Describe the role (20+ characters)").max(10000),
  skills: z.string().max(600),
  eligibility: z.string().trim().max(500),
  openings: z.string().regex(/^\d*$/, "Openings must be a number"),
  apply_deadline: z.string(),
  status: z.enum(["draft", "published", "closed"]),
})
type Draft = z.infer<typeof formSchema>

const toLocal = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function OpportunityForm({ clubId, opportunity, onDone }: { clubId: string; opportunity?: Opportunity; onDone?: () => void }) {
  const router = useRouter()
  const [d, setD] = useState<Draft>({
    kind: opportunity?.kind ?? "internship",
    title: opportunity?.title ?? "",
    company: opportunity?.company ?? "",
    location: opportunity?.location ?? "",
    mode: opportunity?.mode ?? "onsite",
    stipend: opportunity?.stipend ?? "",
    description: opportunity?.description ?? "",
    skills: opportunity?.skills.join(", ") ?? "",
    eligibility: opportunity?.eligibility ?? "",
    openings: opportunity?.openings?.toString() ?? "",
    apply_deadline: toLocal(opportunity?.apply_deadline ?? null),
    status: opportunity?.status ?? "draft",
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const id = opportunity?.id ?? "new"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = formSchema.safeParse(d)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form")
    setError(null)
    setBusy(true)
    const v = parsed.data
    const row = {
      kind: v.kind,
      title: v.title,
      company: v.company,
      location: v.location || null,
      mode: v.mode,
      stipend: v.stipend || null,
      description: v.description,
      skills: v.skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20),
      eligibility: v.eligibility || null,
      openings: v.openings ? Number(v.openings) : null,
      apply_deadline: v.apply_deadline ? new Date(v.apply_deadline).toISOString() : null,
      status: v.status,
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error: dbError } = opportunity
      ? await supabase.from("opportunities").update(row).eq("id", opportunity.id)
      : await supabase.from("opportunities").insert({ ...row, club_id: clubId, posted_by: user?.id ?? null })
    setBusy(false)
    if (dbError) setError(getErrorMessage(dbError, "Could not save"))
    else {
      toast.success(opportunity ? "Saved" : "Opportunity created")
      onDone?.()
      router.refresh()
    }
  }

  const sel = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
  return (
    <form onSubmit={save} noValidate className="space-y-4 rounded-xl border border-border bg-card p-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-title`}>Role title</Label>
          <Input id={`${id}-title`} value={d.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-company`}>Company / organisation</Label>
          <Input id={`${id}-company`} value={d.company} onChange={(e) => set("company", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-kind`}>Type</Label>
          <select id={`${id}-kind`} value={d.kind} onChange={(e) => set("kind", e.target.value as Draft["kind"])} className={sel}>
            <option value="internship">Internship</option>
            <option value="job">Job</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-mode`}>Mode</Label>
          <select id={`${id}-mode`} value={d.mode} onChange={(e) => set("mode", e.target.value as Draft["mode"])} className={sel}>
            <option value="onsite">On-site</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-location`}>Location</Label>
          <Input id={`${id}-location`} value={d.location} onChange={(e) => set("location", e.target.value)} placeholder="Bengaluru" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-stipend`}>Stipend / salary</Label>
          <Input id={`${id}-stipend`} value={d.stipend} onChange={(e) => set("stipend", e.target.value)} placeholder="₹15,000/month" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-openings`}>Openings</Label>
          <Input id={`${id}-openings`} inputMode="numeric" value={d.openings} onChange={(e) => set("openings", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-deadline`}>Apply by</Label>
          <Input id={`${id}-deadline`} type="datetime-local" value={d.apply_deadline} onChange={(e) => set("apply_deadline", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-desc`}>Description</Label>
        <Textarea id={`${id}-desc`} rows={6} value={d.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-skills`}>Skills (comma separated)</Label>
          <Input id={`${id}-skills`} value={d.skills} onChange={(e) => set("skills", e.target.value)} placeholder="React, SQL" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-status`}>Status</Label>
          <select id={`${id}-status`} value={d.status} onChange={(e) => set("status", e.target.value as Draft["status"])} className={sel}>
            <option value="draft">Draft (hidden)</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-elig`}>Eligibility</Label>
        <Textarea id={`${id}-elig`} rows={2} value={d.eligibility} onChange={(e) => set("eligibility", e.target.value)} placeholder="2nd/3rd year CSE/IT students" />
      </div>
      <Button type="submit" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
        {opportunity ? "Save" : "Create opportunity"}
      </Button>
    </form>
  )
}

export type ApplicantRow = Pick<Application, "id" | "status" | "created_at" | "cover_note" | "phone" | "portfolio_url" | "resume_path"> & {
  user: { full_name: string | null; email: string; college: string | null } | null
}

export function ApplicantsTable({ rows }: { rows: ApplicantRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const setStatus = async (id: string, status: Application["status"]) => {
    setBusy(id)
    const { error } = await supabase.from("opportunity_applications").update({ status }).eq("id", id)
    setBusy(null)
    if (error) toast.error(getErrorMessage(error))
    else {
      toast.success(`Marked ${APPLICATION_STATUS[status].label.toLowerCase()}`)
      router.refresh()
    }
  }
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No applications yet.</p>
  return (
    <ul className="space-y-3">
      {rows.map((a) => (
        <li key={a.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">{a.user?.full_name ?? "Applicant"}</p>
              <p className="text-sm text-muted-foreground">
                {[a.user?.email, a.phone, a.user?.college].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {busy === a.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Saving" />}
              <select
                aria-label={`Status for ${a.user?.full_name ?? "applicant"}`}
                value={a.status}
                disabled={busy === a.id}
                onChange={(e) => setStatus(a.id, e.target.value as Application["status"])}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm"
              >
                {(Object.keys(APPLICATION_STATUS) as Application["status"][]).map((s) => (
                  <option key={s} value={s}>{APPLICATION_STATUS[s].label}</option>
                ))}
              </select>
            </div>
          </div>
          {a.cover_note && <p className="mt-3 whitespace-pre-line text-sm text-foreground">{a.cover_note}</p>}
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {a.resume_path && (
              <a href={`/api/opportunities/resume?application=${a.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                <FileDown className="h-4 w-4" aria-hidden /> Résumé
              </a>
            )}
            {a.portfolio_url && (
              <a href={a.portfolio_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                <ExternalLink className="h-4 w-4" aria-hidden /> Portfolio
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
