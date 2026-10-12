"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/utils"

/** Join with a known code (one click) or type one in. */
export function JoinTeamForm({ code, eventId }: { code: string; eventId: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(code)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = value.trim().toUpperCase()
    if (!/^T-[A-Z2-9]{8}$/.test(clean)) return setError("Codes look like T-ABCD2345")
    if (!eventId) {
      router.push(`/teams/join?code=${encodeURIComponent(clean)}`)
      return
    }
    setBusy(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc("join_team", { p_code: clean })
    setBusy(false)
    if (rpcError) return setError(getErrorMessage(rpcError, "Could not join the team"))
    toast.success("You joined the team!")
    router.push(`/events/${eventId}/register`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!code && (
        <div className="space-y-1.5">
          <Label htmlFor="invite-code">Invite code</Label>
          <Input id="invite-code" value={value} onChange={(e) => setValue(e.target.value)} placeholder="T-ABCD2345" className="font-mono uppercase" autoComplete="off" />
        </div>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
        {eventId ? "Join team" : "Continue"}
      </Button>
    </form>
  )
}
