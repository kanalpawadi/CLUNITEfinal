"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { supabase, type Event } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const STATUSES = ["draft", "published", "cancelled", "completed"] as const
type Status = (typeof STATUSES)[number]

const formSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
    category: z.string().trim().max(60),
    description: z.string().trim().max(10000),
    venue: z.string().trim().max(300),
    starts_at: z.string().min(1, "Start date and time are required"),
    ends_at: z.string(),
    registration_deadline: z.string(),
    capacity: z.string().regex(/^\d*$/, "Capacity must be a whole number"),
    fee: z.string().regex(/^\d+(\.\d{1,2})?$/, "Fee must be a number with up to 2 decimals"),
    status: z.enum(STATUSES),
  })
  .refine((v) => !v.ends_at || new Date(v.ends_at) >= new Date(v.starts_at), {
    message: "End must be after start",
    path: ["ends_at"],
  })

type FormState = z.input<typeof formSchema>
type FieldErrors = Partial<Record<keyof FormState, string>>

/** ISO timestamp -> value for <input type="datetime-local"> in the viewer's timezone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const toIso = (local: string) => (local ? new Date(local).toISOString() : null)
const isStatus = (v: string): v is Status => (STATUSES as readonly string[]).includes(v)

export function EventEditForm({ event }: { event: Event }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState<FormState>({
    title: event.title,
    category: event.category ?? "",
    description: event.description ?? "",
    venue: event.venue ?? "",
    starts_at: toLocalInput(event.starts_at),
    ends_at: toLocalInput(event.ends_at),
    registration_deadline: toLocalInput(event.registration_deadline),
    capacity: event.capacity?.toString() ?? "",
    fee: event.fee.toString(),
    status: isStatus(event.status) ? event.status : "draft",
  })

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = formSchema.safeParse(form)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof FormState] ??= issue.message
      setErrors(next)
      return
    }
    setErrors({})
    setSaving(true)
    const v = parsed.data
    const { error } = await supabase
      .from("events")
      .update({
        title: v.title,
        category: v.category || null,
        description: v.description || null,
        venue: v.venue || null,
        starts_at: toIso(v.starts_at) ?? event.starts_at,
        ends_at: toIso(v.ends_at),
        registration_deadline: toIso(v.registration_deadline),
        capacity: v.capacity ? Number.parseInt(v.capacity, 10) : null,
        fee: Number.parseFloat(v.fee),
        status: v.status,
      })
      .eq("id", event.id)
    setSaving(false)
    if (error) {
      toast.error(error.message || "Could not save the event")
      return
    }
    toast.success("Event updated")
    router.refresh()
  }

  const fieldError = (key: keyof FormState) =>
    errors[key] ? (
      <p id={`${key}-error`} role="alert" className="text-sm text-destructive">
        {errors[key]}
      </p>
    ) : null

  return (
    <form className="space-y-8" onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
          <CardDescription>Update the core details of your event</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {event.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.image_url} alt="" className="mx-auto max-h-48 rounded-lg border border-border" />
          )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Event title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                aria-invalid={!!errors.title}
                aria-describedby="title-error"
              />
              {fieldError("title")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" value={form.category} onChange={(e) => set("category", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logistics</CardTitle>
          <CardDescription>Time, place, capacity and price</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="starts_at">Starts *</Label>
            <Input
              id="starts_at"
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => set("starts_at", e.target.value)}
              aria-invalid={!!errors.starts_at}
              aria-describedby="starts_at-error"
            />
            {fieldError("starts_at")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ends_at">Ends</Label>
            <Input
              id="ends_at"
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => set("ends_at", e.target.value)}
              aria-invalid={!!errors.ends_at}
              aria-describedby="ends_at-error"
            />
            {fieldError("ends_at")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue">Venue</Label>
            <Input
              id="venue"
              value={form.venue}
              onChange={(e) => set("venue", e.target.value)}
              placeholder="Room, hall or online link"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registration_deadline">Registration deadline</Label>
            <Input
              id="registration_deadline"
              type="datetime-local"
              value={form.registration_deadline}
              onChange={(e) => set("registration_deadline", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              inputMode="numeric"
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              placeholder="Unlimited"
              aria-invalid={!!errors.capacity}
              aria-describedby="capacity-error"
            />
            {fieldError("capacity")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fee">Fee (INR)</Label>
            <Input
              id="fee"
              inputMode="decimal"
              className="tabular-nums"
              value={form.fee}
              onChange={(e) => set("fee", e.target.value)}
              aria-invalid={!!errors.fee}
              aria-describedby="fee-error"
            />
            {fieldError("fee")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={(v) => isStatus(v) && set("status", v)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Save changes
        </Button>
      </div>
    </form>
  )
}
