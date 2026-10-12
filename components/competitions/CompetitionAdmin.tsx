"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { ExternalLink, FileDown, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { formatDateTime } from "@/lib/events"
import { roundState, submissionTypeLabel, type Round, type Submission } from "@/lib/competitions"
import { getErrorMessage } from "@/lib/utils"

export type AdminRegistration = { id: string; name: string; email: string | null; team_name: string | null }
export type AdminResult = { id: string; registration_id: string; position: number; title: string; published: boolean }

const toLocal = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const label = (r: AdminRegistration) => r.team_name || r.name

// ---------------------------------------------------------------------------------- Rounds

const roundSchema = z
  .object({
    title: z.string().trim().min(2, "Title is too short").max(120),
    description: z.string().trim().max(5000),
    starts_at: z.string().min(1, "Start is required"),
    ends_at: z.string().min(1, "End is required"),
    submission_type: z.enum(["none", "link", "file", "text"]),
    max_score: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Max score must be a number")
      .transform(Number)
      .refine((n) => n > 0 && n <= 100000, "Max score must be between 1 and 100000"),
  })
  .refine((v) => new Date(v.ends_at) > new Date(v.starts_at), { message: "End must be after start", path: ["ends_at"] })

type RoundDraft = z.input<typeof roundSchema>

function RoundForm({ eventId, round, nextNo, onDone }: { eventId: string; round?: Round; nextNo: number; onDone: () => void }) {
  const [draft, setDraft] = useState<RoundDraft>(
    round
      ? {
          title: round.title,
          description: round.description ?? "",
          starts_at: toLocal(round.starts_at),
          ends_at: toLocal(round.ends_at),
          submission_type: round.submission_type,
          max_score: String(round.max_score),
        }
      : { title: `Round ${nextNo}`, description: "", starts_at: "", ends_at: "", submission_type: "link", max_score: "100" },
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const id = round?.id ?? "new"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = roundSchema.safeParse(draft)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid round")
    setError(null)
    setSaving(true)
    const v = parsed.data
    const row = {
      title: v.title,
      description: v.description || null,
      starts_at: new Date(v.starts_at).toISOString(),
      ends_at: new Date(v.ends_at).toISOString(),
      submission_type: v.submission_type,
      max_score: v.max_score,
    }
    const { error: dbError } = round
      ? await supabase.from("event_rounds").update(row).eq("id", round.id)
      : await supabase.from("event_rounds").insert({ ...row, event_id: eventId, round_no: nextNo })
    setSaving(false)
    if (dbError) setError(getErrorMessage(dbError, "Could not save the round"))
    else {
      toast.success(round ? "Round updated" : "Round added")
      onDone()
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-3">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-title`}>Title</Label>
          <Input id={`${id}-title`} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-type`}>Submission</Label>
          <select
            id={`${id}-type`}
            value={draft.submission_type}
            onChange={(e) => setDraft({ ...draft, submission_type: e.target.value as RoundDraft["submission_type"] })}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            {(Object.keys(submissionTypeLabel) as Round["submission_type"][]).map((t) => (
              <option key={t} value={t}>{submissionTypeLabel[t]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-start`}>Opens</Label>
          <Input id={`${id}-start`} type="datetime-local" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-end`}>Closes</Label>
          <Input id={`${id}-end`} type="datetime-local" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-max`}>Max score</Label>
          <Input id={`${id}-max`} inputMode="decimal" className="tabular-nums" value={draft.max_score} onChange={(e) => setDraft({ ...draft, max_score: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-desc`}>Instructions for participants</Label>
        <Textarea id={`${id}-desc`} rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
        {round ? "Save round" : "Add round"}
      </Button>
    </form>
  )
}

export function RoundsEditor({ eventId, rounds }: { eventId: string; rounds: Round[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(rounds.length === 0)
  const [busy, setBusy] = useState<string | null>(null)
  const nextNo = (rounds.at(-1)?.round_no ?? 0) + 1

  const togglePublish = async (round: Round) => {
    setBusy(round.id)
    const { error } = await supabase.from("event_rounds").update({ results_published: !round.results_published }).eq("id", round.id)
    setBusy(null)
    if (error) toast.error(getErrorMessage(error))
    else router.refresh()
  }
  const remove = async (round: Round) => {
    if (!window.confirm(`Delete "${round.title}" and all its submissions?`)) return
    setBusy(round.id)
    const { error } = await supabase.from("event_rounds").delete().eq("id", round.id)
    setBusy(null)
    if (error) toast.error(getErrorMessage(error))
    else router.refresh()
  }

  return (
    <div className="space-y-4">
      {rounds.map((round) => (
        <details key={round.id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-foreground">
              Round {round.round_no}: {round.title}
              <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">{roundState(round)}</span>
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDateTime(round.starts_at)} → {formatDateTime(round.ends_at)}
            </span>
          </summary>
          <div className="mt-4 space-y-4">
            <RoundForm eventId={eventId} round={round} nextNo={round.round_no} onDone={() => router.refresh()} />
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button size="sm" variant={round.results_published ? "outline" : "default"} onClick={() => togglePublish(round)} disabled={busy === round.id}>
                {round.results_published ? "Hide results" : "Publish results"}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(round)} disabled={busy === round.id}>
                <Trash2 className="mr-1 h-4 w-4" aria-hidden /> Delete round
              </Button>
            </div>
          </div>
        </details>
      ))}
      {adding ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-4">
          <RoundForm
            eventId={eventId}
            nextNo={nextNo}
            onDone={() => {
              setAdding(false)
              router.refresh()
            }}
          />
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden /> Add round {nextNo}
        </Button>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------------- Judging

function JudgeRow({ round, registration, submission }: { round: Round; registration: AdminRegistration; submission?: Submission }) {
  const router = useRouter()
  const [score, setScore] = useState(submission?.score?.toString() ?? "")
  const [status, setStatus] = useState<Submission["status"]>(submission?.status ?? "submitted")
  const [feedback, setFeedback] = useState(submission?.feedback ?? "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const n = score.trim() === "" ? null : Number(score)
    if (n !== null && (Number.isNaN(n) || n < 0 || n > round.max_score)) {
      toast.error(`Score must be between 0 and ${round.max_score}`)
      return
    }
    setSaving(true)
    const { error } = await supabase.rpc("judge_round_entry", {
      p_round_id: round.id,
      p_registration_id: registration.id,
      p_score: n ?? undefined,
      p_status: status,
      p_feedback: feedback,
    })
    setSaving(false)
    if (error) toast.error(getErrorMessage(error, "Could not save"))
    else {
      toast.success(`Saved ${label(registration)}`)
      router.refresh()
    }
  }

  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <p className="font-medium text-foreground">{label(registration)}</p>
        <p className="text-xs text-muted-foreground">{registration.email}</p>
      </td>
      <td className="max-w-[260px] px-3 py-2 text-sm">
        {submission?.link_url && (
          <a href={submission.link_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline">
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden /> {submission.link_url}
          </a>
        )}
        {submission?.file_path && (
          <a href={`/api/competitions/file?submission=${submission.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
            <FileDown className="h-3.5 w-3.5" aria-hidden /> Download file
          </a>
        )}
        {submission?.text_content && <p className="line-clamp-4 whitespace-pre-line text-muted-foreground">{submission.text_content}</p>}
        {!submission?.submitted_at && <span className="text-muted-foreground">{round.submission_type === "none" ? "Offline" : "Not submitted"}</span>}
      </td>
      <td className="px-3 py-2">
        <Input
          aria-label={`Score for ${label(registration)}`}
          inputMode="decimal"
          className="h-9 w-20 tabular-nums"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder={`/${round.max_score}`}
        />
      </td>
      <td className="px-3 py-2">
        <select
          aria-label={`Status for ${label(registration)}`}
          value={status}
          onChange={(e) => setStatus(e.target.value as Submission["status"])}
          className="h-9 rounded-md border border-input bg-card px-2 text-sm"
        >
          <option value="submitted">Pending</option>
          <option value="shortlisted">Shortlist</option>
          <option value="eliminated">Eliminate</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <Input aria-label={`Feedback for ${label(registration)}`} className="h-9 min-w-[160px]" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Optional" />
      </td>
      <td className="px-3 py-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" /> : "Save"}
        </Button>
      </td>
    </tr>
  )
}

export function JudgingPanel({ rounds, registrations, submissions }: { rounds: Round[]; registrations: AdminRegistration[]; submissions: Submission[] }) {
  const [roundId, setRoundId] = useState(rounds[0]?.id ?? "")
  const round = rounds.find((r) => r.id === roundId)
  const eligible = useMemo(() => {
    if (!round) return []
    const prev = rounds.filter((r) => r.round_no < round.round_no).sort((a, b) => b.round_no - a.round_no)[0]
    if (!prev) return registrations
    const shortlisted = new Set(submissions.filter((s) => s.round_id === prev.id && s.status === "shortlisted").map((s) => s.registration_id))
    return registrations.filter((r) => shortlisted.has(r.id))
  }, [round, rounds, registrations, submissions])

  if (rounds.length === 0) return <p className="text-sm text-muted-foreground">Add a round first.</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="judge-round">Round</Label>
        <select id="judge-round" value={roundId} onChange={(e) => setRoundId(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm">
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>Round {r.round_no}: {r.title}</option>
          ))}
        </select>
        <span className="text-sm tabular-nums text-muted-foreground">{eligible.length} eligible</span>
      </div>
      {round && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Team / participant</th>
                <th scope="col" className="px-3 py-2 font-medium">Submission</th>
                <th scope="col" className="px-3 py-2 font-medium">Score</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Feedback</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Save</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {eligible.map((reg) => (
                <JudgeRow
                  key={`${round.id}-${reg.id}`}
                  round={round}
                  registration={reg}
                  submission={submissions.find((s) => s.round_id === round.id && s.registration_id === reg.id)}
                />
              ))}
              {eligible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Nobody is eligible yet. Shortlist teams in the previous round first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------------- Results

const TITLES = ["Winner", "1st Runner-up", "2nd Runner-up", "Special Mention"]

export function ResultsEditor({ eventId, registrations, results }: { eventId: string; registrations: AdminRegistration[]; results: AdminResult[] }) {
  const router = useRouter()
  const [regId, setRegId] = useState("")
  const [title, setTitle] = useState(TITLES[results.length] ?? "Special Mention")
  const [busy, setBusy] = useState(false)
  const nextPosition = (results.reduce((m, r) => Math.max(m, r.position), 0) || 0) + 1
  const byId = new Map(registrations.map((r) => [r.id, r]))

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regId) return toast.error("Pick a team")
    setBusy(true)
    const { error } = await supabase
      .from("event_results")
      .insert({ event_id: eventId, registration_id: regId, position: nextPosition, title: title.trim() || "Winner" })
    setBusy(false)
    if (error) toast.error(getErrorMessage(error, "Could not add result"))
    else {
      setRegId("")
      setTitle(TITLES[results.length + 1] ?? "Special Mention")
      router.refresh()
    }
  }
  const update = async (id: string, patch: { published?: boolean }) => {
    const { error } = await supabase.from("event_results").update(patch).eq("id", id)
    if (error) toast.error(getErrorMessage(error))
    else router.refresh()
  }
  const remove = async (id: string) => {
    const { error } = await supabase.from("event_results").delete().eq("id", id)
    if (error) toast.error(getErrorMessage(error))
    else router.refresh()
  }
  const publishAll = async (published: boolean) => {
    const { error } = await supabase.from("event_results").update({ published }).eq("event_id", eventId)
    if (error) toast.error(getErrorMessage(error))
    else {
      toast.success(published ? "Results announced. Winners get achievement certificates." : "Results hidden")
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      {results.length > 0 && (
        <ol className="divide-y divide-border rounded-xl border border-border bg-card">
          {results.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <span>
                <span className="font-semibold tabular-nums text-foreground">#{r.position}</span> {r.title} ·{" "}
                <span className="text-foreground">{byId.get(r.registration_id) ? label(byId.get(r.registration_id)!) : "—"}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`text-xs ${r.published ? "text-success" : "text-muted-foreground"}`}>{r.published ? "Published" : "Draft"}</span>
                <Button size="sm" variant="ghost" onClick={() => update(r.id, { published: !r.published })}>
                  {r.published ? "Unpublish" : "Publish"}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r.id)} aria-label={`Remove ${r.title}`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={add} className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-card p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="result-reg">Team / participant</Label>
          <select id="result-reg" value={regId} onChange={(e) => setRegId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm">
            <option value="">Select…</option>
            {registrations
              .filter((r) => !results.some((x) => x.registration_id === r.id))
              .map((r) => (
                <option key={r.id} value={r.id}>{label(r)}</option>
              ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="result-title">Title (#{nextPosition})</Label>
          <Input id="result-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
        </div>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Add
        </Button>
      </form>
      {results.length > 0 && (
        <div className="flex gap-2">
          <Button onClick={() => publishAll(true)}>Announce all results</Button>
          <Button variant="outline" onClick={() => publishAll(false)}>Hide all</Button>
        </div>
      )}
    </div>
  )
}
