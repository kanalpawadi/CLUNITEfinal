"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Clock, IdCard, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase, type ClubMembership, type MembershipPlan } from "@/lib/supabase"
import { formatDate, formatMoney } from "@/lib/events"
import { benefitsList, daysLeft, durationLabel, effectiveStatus, planAction } from "@/lib/membership"
import { getErrorMessage } from "@/lib/utils"
import { PayButton } from "@/components/payments/PayButton"

const statusStyles: Record<string, string> = {
  active: "border-success/40 bg-success/10 text-success",
  pending: "border-warning/40 bg-warning/10 text-warning",
  expired: "border-destructive/40 bg-destructive/10 text-destructive",
  suspended: "border-destructive/40 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-muted text-muted-foreground",
}

export function MembershipPanel({
  club,
  plans,
  membership,
  user,
}: {
  club: { id: string; name: string; requires_approval: boolean }
  plans: MembershipPlan[]
  membership: ClubMembership | null
  user: { email: string }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const currentPlan = plans.find((p) => p.id === membership?.plan_id) ?? null
  const status = membership ? effectiveStatus(membership) : null
  const left = membership?.status === "active" ? daysLeft(membership.expires_at) : null
  const isStaff = membership ? !["member", "guest"].includes(membership.role) : false

  const joinFree = async (plan: MembershipPlan) => {
    setBusy(plan.id)
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) throw new Error("Please sign in again")
      const nextStatus = club.requires_approval ? "pending" : "active"
      // Re-joining after cancelling/expiry: remove the old row first (RLS lets members delete their own row)
      if (membership && (status === "cancelled" || status === "expired")) {
        const { error: delError } = await supabase.from("club_memberships").delete().eq("id", membership.id)
        if (delError) throw delError
      }
      const { error } = await supabase
        .from("club_memberships")
        .insert({ club_id: club.id, user_id: authUser.id, plan_id: plan.id, status: nextStatus, role: "member" })
      if (error) throw error
      toast.success(nextStatus === "active" ? `Welcome to ${club.name}!` : "Request sent. An admin will review it.")
      router.refresh()
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not join the club"))
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    if (!membership || !window.confirm(`Leave ${club.name}? Paid time is not refunded.`)) return
    setBusy("cancel")
    const { error } = await supabase.from("club_memberships").update({ status: "cancelled" }).eq("id", membership.id)
    setBusy(null)
    if (error) toast.error(getErrorMessage(error, "Could not cancel"))
    else {
      toast.success("Membership cancelled")
      router.refresh()
    }
  }

  return (
    <div className="mt-4 space-y-6">
      {membership && status && (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[status] ?? ""}`}>
                {status}
              </span>
              <span className="text-sm text-foreground">
                {currentPlan?.name ?? "Member"} plan · <span className="capitalize">{membership.role}</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {status === "pending" && "An admin will review your request soon."}
              {status === "active" &&
                (membership.expires_at
                  ? `Valid until ${formatDate(membership.expires_at)}${left !== null && left <= 14 ? ` · ${left} day${left === 1 ? "" : "s"} left, renew soon` : ""}`
                  : "Never expires")}
              {status === "expired" && "Your membership has expired. Renew to keep your benefits."}
              {status === "suspended" && "Your membership is suspended. Contact the club for details."}
              {status === "cancelled" && "You left this club. Join again any time."}
            </p>
            {membership.member_code && <p className="font-mono text-xs text-muted-foreground">Member code {membership.member_code}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "active" && (
              <Button asChild variant="outline" size="sm">
                <Link href="/profile/id-card">
                  <IdCard className="mr-2 h-4 w-4" aria-hidden /> ID card
                </Link>
              </Button>
            )}
            {(status === "active" || status === "pending") && !isStaff && (
              <Button variant="ghost" size="sm" onClick={cancel} disabled={busy === "cancel"}>
                {busy === "cancel" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                Leave club
              </Button>
            )}
          </div>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const action = planAction(plan, membership, currentPlan)
          const isCurrent = status === "active" && membership?.plan_id === plan.id
          return (
            <li
              key={plan.id}
              className={`flex flex-col rounded-xl border bg-card p-5 shadow-soft ${isCurrent ? "border-primary" : "border-border"}`}
              aria-current={isCurrent ? "true" : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
                {isCurrent && <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Current</span>}
              </div>
              <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                {plan.price > 0 ? formatMoney(plan.price, plan.currency) : "Free"}
              </p>
              <p className="text-xs text-muted-foreground">{durationLabel(plan.duration_days)}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
                {benefitsList(plan.benefits).map((b) => (
                  <li key={b} className="flex gap-2">
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /> {b}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {action.kind === "join_free" && (
                  <Button className="w-full" onClick={() => joinFree(plan)} disabled={busy === plan.id}>
                    {busy === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                    {club.requires_approval ? "Request to join" : "Join free"}
                  </Button>
                )}
                {(action.kind === "buy" || action.kind === "renew" || action.kind === "upgrade") && (
                  <PayButton
                    order={{ purpose: "membership", planId: plan.id }}
                    amount={plan.price}
                    label={`${action.kind === "renew" ? "Renew" : action.kind === "upgrade" ? "Upgrade" : "Buy"} · ${formatMoney(plan.price, plan.currency)}`}
                    prefill={{ email: user.email }}
                    onPaid={() => router.refresh()}
                    variant={action.kind === "renew" ? "outline" : "default"}
                  />
                )}
                {action.kind === "current" && <p className="text-sm text-muted-foreground">Your plan</p>}
                {action.kind === "downgrade_blocked" && <p className="text-sm text-muted-foreground">Included in your plan</p>}
                {action.kind === "unavailable" && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" aria-hidden /> {action.reason}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {club.requires_approval && (
        <p className="text-xs text-muted-foreground">Free memberships in this club need admin approval. Paid plans activate immediately.</p>
      )}
    </div>
  )
}
