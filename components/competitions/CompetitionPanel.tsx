"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Clock, Loader2, Lock, Upload, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { formatDateTime } from "@/lib/events"
import { isEligible, roundState, submissionTypeLabel, SUBMISSION_FILE_TYPES, SUBMISSION_MAX_BYTES, type Round, type Submission } from "@/lib/competitions"
import { getErrorMessage } from "@/lib/utils"

function SubmitForm({ round, existing }: { round: Round; existing?: Submission }) {
  const router = useRouter()
  const [link, setLink] = useState(existing?.link_url ?? "")
  const [text, setText] = useState(existing?.text_content ?? "")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      let filePath: string | undefined
      if (round.submission_type === "file") {
        if (!file) throw new Error("Choose a file first")
        if (!SUBMISSION_FILE_TYPES[file.type]) throw new Error("Upload a PDF, ZIP, PPTX, PNG or JPEG file")
        if (file.size > SUBMISSION_MAX_BYTES) throw new Error("File too large (max 20MB)")
        const form = new FormData()
        form.set("roundId", round.id)
        form.set("file", file)
        const res = await fetch("/api/competitions/upload", { method: "POST", body: form })
        const body: { path?: string; error?: string } = await res.json().catch(() => ({}))
        if (!res.ok || !body.path) throw new Error(body.error ?? "Upload failed")
        filePath = body.path
      }
      if (round.submission_type === "link" && !/^https?:\/\/\S+$/i.test(link.trim())) throw new Error("Enter a valid link starting with https://")
      const { error: rpcError } = await supabase.rpc("submit_round_entry", {
        p_round_id: round.id,
        p_link_url: round.submission_type === "link" ? link.trim() : undefined,
        p_text: round.submission_type === "text" ? text : undefined,
        p_file_path: filePath,
      })
      if (rpcError) throw rpcError
      toast.success(existing?.submitted_at ? "Submission updated" : "Submitted!")
      router.refresh()
    } catch (err) {
      setError(getErrorMessage(err, "Could not submit"))
    } finally {
      setBusy(false)
    }
  }

  const id = `sub-${round.id}`
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {round.submission_type === "link" && (
        <div className="space-y-1.5">
          <Label htmlFor={id}>Link</Label>
          <Input id={id} type="url" inputMode="url" placeholder="https://github.com/your-team/project" value={link} onChange={(e) => setLink(e.target.value)} />
        </div>
      )}
      {round.submission_type === "text" && (
        <div className="space-y-1.5">
          <Label htmlFor={id}>Your answer</Label>
          <Textarea id={id} rows={6} maxLength={10000} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      )}
      {round.submission_type === "file" && (
        <div className="space-y-1.5">
          <Label htmlFor={id}>File</Label>
          <Input
            id={id}
            type="file"
            accept=".pdf,.zip,.pptx,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm"
          />
          {existing?.file_path && <p className="text-xs text-muted-foreground">A file is already submitted; uploading replaces it.</p>}
        </div>
      )}
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Upload className="mr-2 h-4 w-4" aria-hidden />}
        {existing?.submitted_at ? "Update submission" : "Submit"}
      </Button>
    </form>
  )
}

/** Rounds timeline for a registered participant: status, eligibility, submit forms and published scores. */
export function CompetitionPanel({ rounds, submissions, blockedReason }: { rounds: Round[]; submissions: Submission[]; blockedReason?: string }) {
  if (rounds.length === 0) return null
  return (
    <section aria-labelledby="rounds-title" className="space-y-3">
      <h2 id="rounds-title" className="text-lg font-semibold text-foreground">Competition rounds</h2>
      {blockedReason && <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{blockedReason}</p>}
      <ol className="space-y-3">
        {rounds.map((round) => {
          const state = roundState(round)
          const mine = submissions.find((s) => s.round_id === round.id)
          const eligible = isEligible(round, rounds, submissions)
          const judged = !!mine && (mine.score !== null || mine.status !== "submitted")
          const canSubmit = !blockedReason && state === "open" && eligible && !judged && round.submission_type !== "none"
          return (
            <li key={round.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Round {round.round_no}</p>
                  <h3 className="font-semibold text-foreground">{round.title}</h3>
                </div>
                <span
                  className={`rounded-md border px-2 py-0.5 text-xs capitalize ${
                    state === "open" ? "border-success/40 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {state}
                </span>
              </div>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {formatDateTime(round.starts_at)} → {formatDateTime(round.ends_at)} · {submissionTypeLabel[round.submission_type]}
              </p>
              {round.description && <p className="mt-2 whitespace-pre-line text-sm text-foreground">{round.description}</p>}

              <div className="mt-3 space-y-2 text-sm">
                {round.results_published && mine && (
                  <p className={`flex items-center gap-2 font-medium ${mine.status === "shortlisted" ? "text-success" : mine.status === "eliminated" ? "text-destructive" : "text-foreground"}`}>
                    {mine.status === "shortlisted" ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : mine.status === "eliminated" ? <XCircle className="h-4 w-4" aria-hidden /> : <Clock className="h-4 w-4" aria-hidden />}
                    {mine.status === "shortlisted" ? "Shortlisted" : mine.status === "eliminated" ? "Not shortlisted" : "Result pending"}
                    {mine.score !== null && <span className="tabular-nums text-muted-foreground"> · {mine.score}/{round.max_score}</span>}
                  </p>
                )}
                {round.results_published && mine?.feedback && <p className="rounded-lg bg-muted p-3 text-muted-foreground">Feedback: {mine.feedback}</p>}
                {mine?.submitted_at && !round.results_published && (
                  <p className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Submitted {formatDateTime(mine.submitted_at)}
                    {judged && " · being judged"}
                  </p>
                )}
                {!eligible && state !== "closed" && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-4 w-4" aria-hidden /> Unlocks if you&apos;re shortlisted in the previous round.
                  </p>
                )}
                {canSubmit && <SubmitForm round={round} existing={mine} />}
                {state === "upcoming" && eligible && <p className="text-muted-foreground">Opens {formatDateTime(round.starts_at)}.</p>}
                {state === "closed" && !mine?.submitted_at && round.submission_type !== "none" && eligible && (
                  <p className="text-muted-foreground">This round has closed.</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
