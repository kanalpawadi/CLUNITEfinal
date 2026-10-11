"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { ClubMembership, MembershipPlan } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { formatMoney } from "@/lib/events"
import { getErrorMessage } from "@/lib/utils"

/** Membership status + plans. Paid plans arrive with payments (Phase 4). */
export function MembershipPanel({
  club,
  plans,
  membership,
}: {
  club: { id: string; name: string; requires_approval: boolean }
  plans: MembershipPlan[]
  membership: ClubMembership | null
  user: { email: string }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const free = plans.find((p) => p.price === 0)

  const joinFree = async () => {
    if (!free) return
    setBusy(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Please sign in again")
      const status = club.requires_approval ? "pending" : "active"
      const { error } = await supabase
        .from("club_memberships")
        .insert({ club_id: club.id, user_id: user.id, plan_id: free.id, status, role: "member" })
      if (error) throw error
      toast.success(status === "active" ? `Welcome to ${club.name}!` : "Request sent. An admin will approve it soon.")
      router.refresh()
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not join the club"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {membership && <p className="text-sm text-muted-foreground">Status: {membership.status}</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <li key={plan.id} className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-foreground">{plan.name}</p>
            <p className="mt-1 text-lg tabular-nums text-foreground">{plan.price > 0 ? formatMoney(plan.price) : "Free"}</p>
          </li>
        ))}
      </ul>
      {!membership && free && (
        <Button onClick={joinFree} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Join for free
        </Button>
      )}
    </div>
  )
}
