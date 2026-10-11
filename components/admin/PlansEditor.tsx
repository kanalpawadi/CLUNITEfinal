"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase, type MembershipPlan } from "@/lib/supabase"
import { benefitsList } from "@/lib/membership"
import { getErrorMessage } from "@/lib/utils"
import type { Enums } from "@/types/database"

const TIERS: Enums<"membership_tier">[] = ["free", "standard", "premium", "lifetime"]

const planSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  tier: z.enum(["free", "standard", "premium", "lifetime"]),
  price: z.coerce.number().min(0, "Price can't be negative").max(1_000_000),
  duration: z.union([z.literal(""), z.coerce.number().int().min(1).max(3650)]),
  benefits: z.string().max(2000),
  is_active: z.boolean(),
})
type Draft = { name: string; tier: Enums<"membership_tier">; price: string; duration: string; benefits: string; is_active: boolean }

const toDraft = (p: MembershipPlan): Draft => ({
  name: p.name,
  tier: p.tier,
  price: String(p.price),
  duration: p.duration_days === null ? "" : String(p.duration_days),
  benefits: benefitsList(p.benefits).join("\n"),
  is_active: p.is_active,
})

function PlanForm({ clubId, plan, onDone }: { clubId: string; plan?: MembershipPlan; onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(
    plan ? toDraft(plan) : { name: "", tier: "standard", price: "0", duration: "365", benefits: "", is_active: true },
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const id = plan?.id ?? "new"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = planSchema.safeParse(draft)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid plan")
      return
    }
    setError(null)
    setSaving(true)
    const v = parsed.data
    const row = {
      name: v.name,
      tier: v.tier,
      price: v.price,
      duration_days: v.duration === "" ? null : v.duration,
      benefits: v.benefits.split("\n").map((b) => b.trim()).filter(Boolean),
      is_active: v.is_active,
    }
    const { error: dbError } = plan
      ? await supabase.from("membership_plans").update(row).eq("id", plan.id)
      : await supabase.from("membership_plans").insert({ ...row, club_id: clubId })
    setSaving(false)
    if (dbError) setError(getErrorMessage(dbError, "Could not save plan"))
    else {
      toast.success(plan ? "Plan updated" : "Plan created")
      onDone()
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border border-border bg-card p-4" noValidate>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input id={`${id}-name`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-tier`}>Tier</Label>
          <select
            id={`${id}-tier`}
            value={draft.tier}
            onChange={(e) => setDraft({ ...draft, tier: e.target.value as Enums<"membership_tier"> })}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm capitalize"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-price`}>Price (INR)</Label>
          <Input id={`${id}-price`} inputMode="decimal" className="tabular-nums" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-duration`}>Duration (days, blank = never expires)</Label>
          <Input id={`${id}-duration`} inputMode="numeric" className="tabular-nums" value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-benefits`}>Benefits (one per line)</Label>
        <Textarea id={`${id}-benefits`} rows={3} value={draft.benefits} onChange={(e) => setDraft({ ...draft, benefits: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="h-4 w-4 accent-primary" />
        Visible to members
      </label>
      <Button type="submit" size="sm" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
        {plan ? "Save plan" : "Create plan"}
      </Button>
    </form>
  )
}

export function PlansEditor({ clubId, plans, canEdit }: { clubId: string; plans: MembershipPlan[]; canEdit: boolean }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  if (!canEdit) {
    return <p className="text-sm text-muted-foreground">Only owners and admins can change plans.</p>
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((p) => (
          <PlanForm key={p.id} clubId={clubId} plan={p} onDone={() => router.refresh()} />
        ))}
      </div>
      {adding ? (
        <PlanForm
          clubId={clubId}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden /> Add plan
        </Button>
      )}
    </div>
  )
}

export function ClubSettings({ club, canEdit }: { club: { id: string; requires_approval: boolean }; canEdit: boolean }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const toggle = async (value: boolean) => {
    setSaving(true)
    const { error } = await supabase.from("clubs").update({ requires_approval: value }).eq("id", club.id)
    setSaving(false)
    if (error) toast.error(getErrorMessage(error, "Could not save"))
    else router.refresh()
  }
  return (
    <label className="flex items-center gap-3 text-sm text-foreground">
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={club.requires_approval}
        disabled={!canEdit || saving}
        onChange={(e) => toggle(e.target.checked)}
      />
      Free members need approval before they become active
      {saving && <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" />}
    </label>
  )
}
