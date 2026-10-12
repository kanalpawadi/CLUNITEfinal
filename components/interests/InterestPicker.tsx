"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { INTERESTS, isInterestId } from "@/lib/interests"
import { getErrorMessage } from "@/lib/utils"

const MAX = 8

/** Toggle chips for the student's interests; saved to users.interests (own row, column-level grant). */
export function InterestPicker({ userId, initial, compact = false }: { userId: string; initial: string[]; compact?: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(initial.filter(isInterestId))
  const [saving, setSaving] = useState(false)
  const dirty = selected.slice().sort().join() !== initial.filter(isInterestId).slice().sort().join()

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX ? s : [...s, id]))

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from("users").update({ interests: selected }).eq("id", userId)
    setSaving(false)
    if (error) toast.error(getErrorMessage(error, "Could not save interests"))
    else {
      toast.success("Interests saved")
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Your interests" className="flex flex-wrap gap-2">
        {INTERESTS.map((interest) => {
          const on = selected.includes(interest.id)
          return (
            <button
              key={interest.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(interest.id)}
              disabled={!on && selected.length >= MAX}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-accent"
              }`}
            >
              {on && <Check className="h-3.5 w-3.5" aria-hidden />}
              {interest.label}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving || !dirty} size={compact ? "sm" : "default"}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Save interests
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {selected.length}/{MAX} selected
        </span>
      </div>
    </div>
  )
}
