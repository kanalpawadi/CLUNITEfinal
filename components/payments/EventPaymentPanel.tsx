"use client"

import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { formatMoney } from "@/lib/events"
import { PayButton } from "./PayButton"

/** Payment step for a paid event registration. */
export function EventPaymentPanel({
  eventId,
  amount,
  paid,
  email,
  name,
}: {
  eventId: string
  amount: number
  paid: boolean
  email: string
  name: string
}) {
  const router = useRouter()
  if (paid) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Payment of {formatMoney(amount)} received.
      </p>
    )
  }
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-sm text-foreground">
        Your seat is held. Pay <span className="font-semibold tabular-nums">{formatMoney(amount)}</span> to confirm it.
      </p>
      <div className="mt-3">
        <PayButton order={{ purpose: "event", eventId }} amount={amount} prefill={{ email, name }} onPaid={() => router.refresh()} />
      </div>
    </div>
  )
}
