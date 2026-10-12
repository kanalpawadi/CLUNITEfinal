"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { participantDetailsSchema, type RegistrationData } from "@/lib/registration-data"
import { validateAnswers, type Answers, type Question } from "@/lib/questions"
import { Textarea } from "@/components/ui/textarea"
import type { TeamRange } from "@/lib/events"
import { getErrorMessage } from "@/lib/utils"

type Member = { name: string; email: string; phone: string; college: string; year: string; branch: string }

const phoneSchema = z.string().trim().regex(/^[+\d][\d\s-]{6,19}$/, "Enter a valid phone number")
const memberSchema = participantDetailsSchema.extend({ phone: phoneSchema })

const blank = (): Member => ({ name: "", email: "", phone: "", college: "", year: "", branch: "" })

export function RegisterForm({
  eventId,
  team,
  defaults,
  questions = [],
}: {
  eventId: string
  team: TeamRange
  defaults: { name: string; email: string; phone: string; college: string; branch: string }
  questions?: Question[]
}) {
  const router = useRouter()
  const [teamName, setTeamName] = useState("")
  const [members, setMembers] = useState<Member[]>(() => {
    const first: Member = { ...blank(), ...defaults, year: "" }
    return [first, ...Array.from({ length: team.min - 1 }, blank)]
  })
  const [notes, setNotes] = useState("")
  const [answers, setAnswers] = useState<Answers>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const update = (i: number, key: keyof Member, value: string) =>
    setMembers((list) => list.map((m, idx) => (idx === i ? { ...m, [key]: value } : m)))

  const validate = (): RegistrationData | null => {
    const next: Record<string, string> = {}
    if (team.isTeam && teamName.trim().length < 2) next.teamName = "Enter a team name"
    const parsed = members.map((m, i) => {
      const r = memberSchema.safeParse(m)
      if (!r.success) for (const issue of r.error.issues) next[`${i}.${String(issue.path[0])}`] ??= issue.message
      return r.success ? r.data : null
    })
    const emails = members.map((m) => m.email.trim().toLowerCase())
    emails.forEach((e, i) => {
      if (e && emails.indexOf(e) !== i) next[`${i}.email`] = "Each member needs a different email"
    })
    for (const [id, msg] of Object.entries(validateAnswers(questions, answers))) next[`q.${id}`] = msg
    setErrors(next)
    if (Object.keys(next).length > 0 || parsed.some((p) => p === null)) return null
    const valid = parsed.filter((p): p is z.infer<typeof memberSchema> => p !== null)
    return {
      registration_type: team.isTeam ? "team" : "solo",
      participant_details: team.isTeam ? null : valid[0],
      team_members: team.isTeam ? valid : null,
      answers: Object.fromEntries(
        questions.flatMap((q) => {
          const v = answers[q.id]
          return v === undefined || v === "" ? [] : [[q.id, typeof v === "string" ? v.trim() : v]]
        }),
      ),
      additional_info: { dietaryRestrictions: notes.trim() || null },
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const data = validate()
    if (!data) {
      setFormError("Please fix the highlighted fields.")
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc("register_for_event", {
        p_event_id: eventId,
        p_team_name: team.isTeam ? teamName.trim() : undefined,
        p_registration_data: data,
        p_participant_count: members.length,
      })
      if (error) throw error
      // Confirmation email is best-effort; registration already succeeded
      void fetch("/api/notifications/registration-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      }).catch(() => undefined)
      toast.success("You're registered!")
      router.refresh()
    } catch (err) {
      setFormError(getErrorMessage(err, "Registration failed. Please try again."))
    } finally {
      setSubmitting(false)
    }
  }

  const field = (i: number, key: keyof Member, label: string, props: React.ComponentProps<typeof Input> = {}) => {
    const id = `m${i}-${key}`
    const err = errors[`${i}.${key}`]
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          value={members[i]?.[key] ?? ""}
          onChange={(ev) => update(i, key, ev.target.value)}
          aria-invalid={!!err}
          aria-describedby={err ? `${id}-error` : undefined}
          {...props}
        />
        {err && (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {err}
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      {team.isTeam && (
        <div className="space-y-1.5">
          <Label htmlFor="teamName">Team name</Label>
          <Input
            id="teamName"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            aria-invalid={!!errors.teamName}
            aria-describedby={errors.teamName ? "teamName-error" : undefined}
          />
          {errors.teamName && (
            <p id="teamName-error" className="text-sm text-destructive">
              {errors.teamName}
            </p>
          )}
        </div>
      )}

      {members.map((_, i) => (
        <fieldset key={i} className="rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-medium text-foreground">
            {team.isTeam ? (i === 0 ? "You (team lead)" : `Member ${i + 1}`) : "Your details"}
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {field(i, "name", "Full name", { autoComplete: i === 0 ? "name" : "off" })}
            {field(i, "email", "Email", { type: "email", readOnly: i === 0, autoComplete: i === 0 ? "email" : "off" })}
            {field(i, "phone", "Phone", { type: "tel", inputMode: "tel", autoComplete: i === 0 ? "tel" : "off" })}
            {field(i, "college", "College (optional)")}
            {field(i, "year", "Year of study (optional)")}
            {field(i, "branch", "Branch (optional)")}
          </div>
          {team.isTeam && i >= team.min && (
            <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setMembers((l) => l.filter((__, idx) => idx !== i))}>
              <Trash2 className="mr-1 h-4 w-4" aria-hidden /> Remove member
            </Button>
          )}
        </fieldset>
      ))}

      {team.isTeam && members.length < team.max && (
        <Button type="button" variant="outline" onClick={() => setMembers((l) => [...l, blank()])}>
          <Plus className="mr-1 h-4 w-4" aria-hidden /> Add member
        </Button>
      )}

      {questions.length > 0 && (
        <fieldset className="space-y-4 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-medium text-foreground">Questions from the organizers</legend>
          {questions.map((q) => {
            const id = `q-${q.id}`
            const err = errors[`q.${q.id}`]
            const describe = err ? `${id}-error` : undefined
            const value = answers[q.id]
            return (
              <div key={q.id} className="space-y-1.5">
                {q.type === "checkbox" ? (
                  <label className="flex items-start gap-2 text-sm text-foreground">
                    <input
                      id={id}
                      type="checkbox"
                      checked={value === true}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.checked }))}
                      aria-invalid={!!err}
                      aria-describedby={describe}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <span>
                      {q.label}
                      {q.required && <span className="text-destructive"> *</span>}
                    </span>
                  </label>
                ) : (
                  <>
                    <Label htmlFor={id}>
                      {q.label}
                      {q.required ? <span className="text-destructive"> *</span> : <span className="text-muted-foreground"> (optional)</span>}
                    </Label>
                    {q.type === "textarea" ? (
                      <Textarea id={id} rows={3} maxLength={2000} value={typeof value === "string" ? value : ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} aria-invalid={!!err} aria-describedby={describe} />
                    ) : q.type === "select" ? (
                      <select id={id} value={typeof value === "string" ? value : ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} aria-invalid={!!err} aria-describedby={describe} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm">
                        <option value="">Select…</option>
                        {(q.options ?? []).map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <Input id={id} type={q.type === "url" ? "url" : "text"} inputMode={q.type === "url" ? "url" : undefined} maxLength={2000} value={typeof value === "string" ? value : ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} aria-invalid={!!err} aria-describedby={describe} />
                    )}
                  </>
                )}
                {err && (
                  <p id={`${id}-error`} className="text-sm text-destructive">
                    {err}
                  </p>
                )}
              </div>
            )
          })}
        </fieldset>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes">Dietary needs or accessibility requests (optional)</Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
      </div>

      <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
        Confirm registration
      </Button>
    </form>
  )
}
