"use client"

import { formatMoney } from "@/lib/events"

/** Placeholder until payments land (Phase 4). */
export function EventPaymentPanel({ amount, paid }: { eventId: string; amount: number; paid: boolean; email: string; name: string }) {
  return (
    <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
      {paid ? "Payment received." : `Payment of ${formatMoney(amount)} will be available here shortly.`}
    </p>
  )
}
