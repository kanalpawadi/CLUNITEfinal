"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Loader2, Megaphone, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { postJson } from "@/lib/api-client"
import { QUESTION_TYPES, newQuestionId, questionsSchema, type Question, type QuestionType } from "@/lib/questions"
import { getErrorMessage } from "@/lib/utils"

type Draft = Question & { optionsText: string }

export function QuestionsEditor({ eventId, initial }: { eventId: string; initial: Question[] }) {
  const router = useRouter()
  const [items, setItems] = useState<Draft[]>(initial.map((q) => ({ ...q, optionsText: (q.options ?? []).join(", ") })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (i: number, patch: Partial<Draft>) => setItems((list) => list.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  const move = (i: number, dir: -1 | 1) =>
    setItems((list) => {
      const next = [...list]
      const j = i + dir
      if (j < 0 || j >= next.length) return list
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })

  const save = async () => {
    const questions: Question[] = items.map(({ optionsText, ...q }) => ({
      ...q,
      label: q.label.trim(),
      options: q.type === "select" ? optionsText.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
    }))
    const parsed = questionsSchema.safeParse(questions)
    if (!parsed.success) return setError("Every question needs a label (2+ characters); dropdowns need at least one option.")
    if (questions.some((q) => q.type === "select" && !q.options?.length)) return setError("Dropdown questions need at least one option.")
    setError(null)
    setSaving(true)
    const { error: dbError } = await supabase.from("events").update({ registration_questions: parsed.data }).eq("id", eventId)
    setSaving(false)
    if (dbError) setError(getErrorMessage(dbError, "Could not save"))
    else {
      toast.success("Registration form saved")
      router.refresh()
    }
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-muted-foreground">No custom questions. Name, email and phone are always collected.</p>}
      <ol className="space-y-3">
        {items.map((q, i) => (
          <li key={q.id} className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="space-y-1.5">
                <Label htmlFor={`${q.id}-label`}>Question {i + 1}</Label>
                <Input id={`${q.id}-label`} value={q.label} maxLength={200} onChange={(e) => update(i, { label: e.target.value })} placeholder="e.g. Link to your GitHub" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${q.id}-type`}>Type</Label>
                <select id={`${q.id}-type`} value={q.type} onChange={(e) => update(i, { type: e.target.value as QuestionType })} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm">
                  {(Object.keys(QUESTION_TYPES) as QuestionType[]).map((t) => (
                    <option key={t} value={t}>{QUESTION_TYPES[t]}</option>
                  ))}
                </select>
              </div>
            </div>
            {q.type === "select" && (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor={`${q.id}-opts`}>Options (comma separated)</Label>
                <Input id={`${q.id}-opts`} value={q.optionsText} onChange={(e) => update(i, { optionsText: e.target.value })} placeholder="S, M, L, XL" />
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} className="h-4 w-4 accent-primary" />
                Required
              </label>
              <div className="ml-auto flex gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move question ${i + 1} up`}>
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move question ${i + 1} down`}>
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setItems((l) => l.filter((_, idx) => idx !== i))} aria-label={`Delete question ${i + 1}`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={items.length >= 20}
          onClick={() => setItems((l) => [...l, { id: newQuestionId(), label: "", type: "text", required: false, optionsText: "" }])}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden /> Add question
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Save form
        </Button>
      </div>
    </div>
  )
}

export function AnnouncementComposer({ eventId, registrants }: { eventId: string; registrants: number }) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [email, setEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 3 || !body.trim()) return setError("Add a title (3+ characters) and a message.")
    if (email && !window.confirm(`Email this to ${registrants} registrant${registrants === 1 ? "" : "s"} (and their team members)?`)) return
    setError(null)
    setBusy(true)
    try {
      const res = await postJson<{ emailed: number }>(`/api/events/${eventId}/announce`, { title, body, email })
      toast.success(email ? `Announced and emailed to ${res.emailed} people` : "Announcement posted")
      setTitle("")
      setBody("")
      setEmail(false)
      router.refresh()
    } catch (err) {
      setError(getErrorMessage(err, "Could not post"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={send} noValidate className="space-y-3 rounded-xl border border-border bg-card p-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="space-y-1.5">
        <Label htmlFor="ann-title">Title</Label>
        <Input id="ann-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Venue changed to Hall B" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ann-body">Message</Label>
        <Textarea id="ann-body" rows={4} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="h-4 w-4 accent-primary" />
        Also email all {registrants} registrants
      </label>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Megaphone className="mr-2 h-4 w-4" aria-hidden />}
        Post announcement
      </Button>
    </form>
  )
}
