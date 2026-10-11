import type { ClubMembership, MembershipPlan } from "@/lib/supabase"
import type { Enums } from "@/types/database"

const TIER_ORDER: Record<Enums<"membership_tier">, number> = { free: 0, standard: 1, premium: 2, lifetime: 3 }

/** `active` rows whose expiry passed are shown (and treated) as expired until the cron job flips them. */
export function effectiveStatus(m: Pick<ClubMembership, "status" | "expires_at">, now = new Date()): Enums<"membership_status"> {
  if (m.status === "active" && m.expires_at && new Date(m.expires_at) < now) return "expired"
  return m.status
}

export function daysLeft(expiresAt: string | null, now = new Date()): number | null {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000)
}

export type PlanAction =
  | { kind: "current" }
  | { kind: "join_free" }
  | { kind: "buy" }
  | { kind: "renew" }
  | { kind: "upgrade" }
  | { kind: "downgrade_blocked" }
  | { kind: "unavailable"; reason: string }

/** What the member can do with `plan`, given their current membership. */
export function planAction(plan: MembershipPlan, membership: ClubMembership | null, currentPlan: MembershipPlan | null): PlanAction {
  const status = membership ? effectiveStatus(membership) : null
  if (status === "suspended") return { kind: "unavailable", reason: "Membership suspended" }

  const isFree = plan.price === 0
  if (!membership || status === "cancelled" || status === "expired") {
    if (isFree) return membership && status !== "cancelled" ? { kind: "current" } : { kind: "join_free" }
    return membership?.plan_id === plan.id ? { kind: "renew" } : { kind: "buy" }
  }

  if (status === "pending") return isFree ? { kind: "unavailable", reason: "Awaiting approval" } : { kind: "buy" }

  // active
  if (membership.plan_id === plan.id) {
    return plan.duration_days === null || isFree ? { kind: "current" } : { kind: "renew" }
  }
  if (isFree) return { kind: "downgrade_blocked" }
  const currentRank = currentPlan ? TIER_ORDER[currentPlan.tier] : 0
  return TIER_ORDER[plan.tier] > currentRank ? { kind: "upgrade" } : { kind: "downgrade_blocked" }
}

export function benefitsList(benefits: MembershipPlan["benefits"]): string[] {
  return Array.isArray(benefits) ? benefits.filter((b): b is string => typeof b === "string") : []
}

export function durationLabel(days: number | null): string {
  if (days === null) return "No expiry"
  if (days % 365 === 0) return days === 365 ? "1 year" : `${days / 365} years`
  if (days % 30 === 0) return days === 30 ? "1 month" : `${days / 30} months`
  return `${days} days`
}
