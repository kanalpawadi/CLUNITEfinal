"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/utils"

/** Opt in/out of the public student leaderboard. */
export function LeaderboardToggle({ userId, initial }: { userId: string; initial: boolean }) {
  const router = useRouter()
  const [on, setOn] = useState(initial)
  const [saving, setSaving] = useState(false)

  const change = async (value: boolean) => {
    setOn(value)
    setSaving(true)
    const { error } = await supabase.from("users").update({ show_on_leaderboard: value }).eq("id", userId)
    setSaving(false)
    if (error) {
      setOn(!value)
      toast.error(getErrorMessage(error, "Could not save"))
    } else {
      toast.success(value ? "You're visible on the leaderboard" : "You're hidden from the leaderboard")
      router.refresh()
    }
  }

  return (
    <label className="flex items-start gap-3 text-sm text-foreground">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-primary"
        checked={on}
        disabled={saving}
        onChange={(e) => void change(e.target.checked)}
      />
      <span>
        Show me on the leaderboard
        <span className="block text-xs text-muted-foreground">Only your first name, last initial, photo and points are shown.</span>
      </span>
      {saving && <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" />}
    </label>
  )
}
