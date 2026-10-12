"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Copy, Loader2, LogOut, RefreshCw, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/utils"

export type RosterEntry = { name: string; is_lead: boolean; is_me: boolean; joined_at: string }

/** Team invite + roster. Leads share/rotate the code; members can leave. */
export function TeamPanel({
  eventId,
  registrationId,
  teamName,
  inviteCode,
  isLead,
  roster,
  capacity,
}: {
  eventId: string
  registrationId: string
  teamName: string | null
  inviteCode: string | null
  isLead: boolean
  roster: RosterEntry[]
  capacity: number
}) {
  const router = useRouter()
  const [code, setCode] = useState(inviteCode)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [origin, setOrigin] = useState("")
  useEffect(() => setOrigin(window.location.origin), [])
  const link = code ? `${origin}/teams/join?code=${code}` : ""
  const full = roster.length >= capacity

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Copy failed. Select the link and copy it manually.")
    }
  }

  const rotate = async () => {
    if (!window.confirm("Create a new invite code? The old link will stop working.")) return
    setBusy(true)
    const { data, error } = await supabase.rpc("rotate_invite_code", { p_registration_id: registrationId })
    setBusy(false)
    if (error) toast.error(getErrorMessage(error))
    else {
      setCode(data)
      toast.success("New invite code ready")
    }
  }

  const leave = async () => {
    if (!window.confirm("Leave this team?")) return
    setBusy(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from("team_members").delete().eq("registration_id", registrationId).eq("user_id", user?.id ?? "")
    setBusy(false)
    if (error) toast.error(getErrorMessage(error))
    else {
      toast.success("You left the team")
      router.refresh()
    }
  }

  return (
    <section aria-labelledby="team-title" className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="team-title" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Users className="h-5 w-5 text-primary" aria-hidden /> {teamName ?? "Your team"}
        </h2>
        <span className="text-sm tabular-nums text-muted-foreground">
          {roster.length}/{capacity} members
        </span>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {roster.map((m, i) => (
          <li key={`${m.name}-${i}`} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-foreground">
              {m.name}
              {m.is_me && <span className="ml-1 text-xs text-primary">(you)</span>}
            </span>
            <span className="text-xs text-muted-foreground">{m.is_lead ? "Lead" : "Member"}</span>
          </li>
        ))}
      </ul>

      {isLead && code && !full && (
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            Invite teammates: they sign in, open this link and join. Code{" "}
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{code}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <input readOnly value={link} aria-label="Invite link" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="mr-1 h-4 w-4" aria-hidden /> : <Copy className="mr-1 h-4 w-4" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" onClick={rotate} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="mr-1 h-4 w-4" aria-hidden />}
              New code
            </Button>
          </div>
        </div>
      )}
      {isLead && full && <p className="text-sm text-success">Your team is complete.</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-sm">
        <Link href={`/events/${eventId}/teams`} className="text-primary underline-offset-4 hover:underline">
          {isLead && !full ? "Find teammates on the team board" : "Team board"}
        </Link>
        {!isLead && (
          <Button size="sm" variant="ghost" onClick={leave} disabled={busy}>
            <LogOut className="mr-1 h-4 w-4" aria-hidden /> Leave team
          </Button>
        )}
      </div>
    </section>
  )
}
