import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getProfile, requireAuthUser } from "@/lib/auth/server"
import { formatDateTime, formatMoney } from "@/lib/events"
import { SiteHeader } from "@/components/site/SiteHeader"
import { PrintButton } from "@/components/payments/PrintButton"

export const metadata: Metadata = { title: "Receipt · Clunite" }

const statusText = { created: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded" } as const

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  await requireAuthUser(`/payments/${params.id}`)
  const supabase = createClient()
  // RLS: the payer, or the club's owner/admin/treasurer
  const { data: payment } = await supabase
    .from("payments")
    .select(
      "*, club:clubs(name), event:events(title, starts_at), plan:membership_plans(name, duration_days), payer:users!payments_user_id_fkey(full_name, email)",
    )
    .eq("id", params.id)
    .maybeSingle()
  if (!payment) notFound()
  const profile = await getProfile()
  const payer = payment.payer ?? profile

  const item =
    payment.purpose === "event"
      ? `Event registration: ${payment.event?.title ?? "event"}`
      : `Membership: ${payment.plan?.name ?? "plan"}${payment.club ? ` (${payment.club.name})` : ""}`

  return (
    <>
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <main id="main" className="mx-auto max-w-2xl px-4 py-10 print:py-0">
        <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
          <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground">
            ← Profile
          </Link>
          <PrintButton label="Print receipt" />
        </div>
        <article className="rounded-xl border border-border bg-card p-6 shadow-soft print:border-0 print:shadow-none sm:p-8">
          <header className="flex flex-col gap-2 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">
                <span aria-hidden className="text-primary">
                  ›_
                </span>{" "}
                clunite
              </p>
              <h1 className="mt-2 text-xl font-semibold text-foreground">Payment receipt</h1>
            </div>
            <div className="text-sm sm:text-right">
              <p className="font-mono text-foreground">{payment.receipt_no ?? "—"}</p>
              <p className="text-muted-foreground">{formatDateTime(payment.paid_at ?? payment.created_at)}</p>
            </div>
          </header>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 py-6 text-sm sm:grid-cols-[160px_1fr]">
            <dt className="text-muted-foreground">Billed to</dt>
            <dd className="text-foreground">
              {payer?.full_name ?? "Member"}
              <br />
              <span className="text-muted-foreground">{payer?.email}</span>
            </dd>
            <dt className="text-muted-foreground">Item</dt>
            <dd className="text-foreground">{item}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd className={payment.status === "paid" ? "font-medium text-success" : "font-medium text-destructive"}>
              {statusText[payment.status]}
              {payment.failure_reason && <span className="block font-normal text-muted-foreground">{payment.failure_reason}</span>}
            </dd>
            <dt className="text-muted-foreground">Order ID</dt>
            <dd className="break-all font-mono text-xs text-foreground">{payment.razorpay_order_id}</dd>
            {payment.razorpay_payment_id && (
              <>
                <dt className="text-muted-foreground">Payment ID</dt>
                <dd className="break-all font-mono text-xs text-foreground">{payment.razorpay_payment_id}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Method</dt>
            <dd className="text-foreground">{payment.provider === "mock" ? "Test payment (mock mode)" : "Razorpay"}</dd>
          </dl>

          <div className="flex items-center justify-between border-t border-border pt-6">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">{formatMoney(payment.amount, payment.currency)}</span>
          </div>
          {payment.provider === "mock" && (
            <p className="mt-6 text-xs text-muted-foreground">This receipt is for a simulated payment. No money was charged.</p>
          )}
        </article>
      </main>
    </>
  )
}
