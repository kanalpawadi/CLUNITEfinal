"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, CreditCard, FlaskConical, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { postJson } from "@/lib/api-client"
import { formatMoney } from "@/lib/events"
import { getErrorMessage } from "@/lib/utils"
import type { CreateOrderInput, CreateOrderResponse, VerifyResponse } from "@/lib/payments/schema"
import { openRazorpayCheckout } from "@/lib/payments/razorpay-checkout"

type State =
  | { step: "idle" }
  | { step: "creating" }
  | { step: "mock"; order: Extract<CreateOrderResponse, { mode: "mock" }> }
  | { step: "checkout" }
  | { step: "verifying" }
  | { step: "success"; result: VerifyResponse }
  | { step: "failed"; message: string }

export function PayButton({
  order,
  amount,
  label,
  prefill,
  onPaid,
  variant = "default",
}: {
  order: CreateOrderInput
  amount: number
  label?: string
  prefill?: { name?: string; email?: string }
  onPaid?: (result: VerifyResponse) => void
  variant?: "default" | "outline"
}) {
  const [state, setState] = useState<State>({ step: "idle" })

  const finish = (result: VerifyResponse) => {
    if (result.status === "paid") {
      setState({ step: "success", result })
      onPaid?.(result)
    } else {
      setState({ step: "failed", message: "The payment did not go through. You have not been charged." })
    }
  }

  const start = async () => {
    setState({ step: "creating" })
    try {
      const created = await postJson<CreateOrderResponse>("/api/payments/create-order", order)
      if (created.mode === "mock") {
        setState({ step: "mock", order: created })
        return
      }
      setState({ step: "checkout" })
      const outcome = await openRazorpayCheckout({
        key: created.keyId,
        amount: created.amountMinor,
        currency: created.currency,
        order_id: created.orderId,
        name: "Clunite",
        description: created.description,
        prefill,
        theme: { color: "#AA4E2C" },
      })
      if (outcome.kind === "dismissed") {
        setState({ step: "idle" })
        return
      }
      setState({ step: "verifying" })
      const result =
        outcome.kind === "success"
          ? await postJson<VerifyResponse>("/api/payments/verify", {
              mode: "razorpay",
              orderId: outcome.response.razorpay_order_id,
              paymentId: outcome.response.razorpay_payment_id,
              signature: outcome.response.razorpay_signature,
            })
          : await postJson<VerifyResponse>("/api/payments/verify", {
              mode: "failed",
              orderId: created.orderId,
              reason: outcome.reason,
            })
      finish(result)
    } catch (err) {
      setState({ step: "failed", message: getErrorMessage(err, "Payment could not be started.") })
    }
  }

  const completeMock = async (outcome: "success" | "failure") => {
    if (state.step !== "mock") return
    const { orderId, mockToken } = state.order
    setState({ step: "verifying" })
    try {
      finish(await postJson<VerifyResponse>("/api/payments/verify", { mode: "mock", orderId, mockToken, outcome }))
    } catch (err) {
      setState({ step: "failed", message: getErrorMessage(err) })
    }
  }

  if (state.step === "success") {
    return (
      <div role="status" className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Payment received · {formatMoney(amount)}
        </p>
        <Link
          href={`/payments/${state.result.paymentId}`}
          className="mt-1 inline-block text-foreground underline underline-offset-4 hover:text-primary"
        >
          View receipt{state.result.receiptNo ? ` ${state.result.receiptNo}` : ""}
        </Link>
      </div>
    )
  }

  const busy = state.step === "creating" || state.step === "checkout" || state.step === "verifying"

  return (
    <div className="space-y-2">
      {state.step === "failed" && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
      <Button onClick={start} disabled={busy} variant={variant} aria-busy={busy}>
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : state.step === "failed" ? (
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
        ) : (
          <CreditCard className="mr-2 h-4 w-4" aria-hidden />
        )}
        {state.step === "verifying"
          ? "Confirming payment…"
          : state.step === "failed"
            ? "Try again"
            : (label ?? `Pay ${formatMoney(amount)}`)}
      </Button>

      <Dialog open={state.step === "mock"} onOpenChange={(open) => !open && setState({ step: "idle" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" aria-hidden /> Test checkout
            </DialogTitle>
            <DialogDescription>
              Payments are in mock mode: no money moves and nothing is sent to a payment provider.
            </DialogDescription>
          </DialogHeader>
          {state.step === "mock" && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border bg-background p-3 text-sm">
              <dt className="text-muted-foreground">For</dt>
              <dd className="text-foreground">{state.order.description}</dd>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="tabular-nums text-foreground">{formatMoney(state.order.amount, state.order.currency)}</dd>
              <dt className="text-muted-foreground">Order</dt>
              <dd className="truncate font-mono text-xs text-foreground">{state.order.orderId}</dd>
            </dl>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => completeMock("failure")}>
              Simulate failure
            </Button>
            <Button onClick={() => completeMock("success")}>Pay {formatMoney(amount)} (test)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
