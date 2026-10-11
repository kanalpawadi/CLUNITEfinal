"use client"

/** Minimal types for Razorpay Checkout (https://checkout.razorpay.com/v1/checkout.js). */
export interface RazorpaySuccess {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

interface RazorpayFailure {
  error: { description?: string; reason?: string }
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description: string
  prefill?: { name?: string; email?: string }
  theme?: { color?: string }
  handler: (response: RazorpaySuccess) => void
  modal?: { ondismiss?: () => void }
}

interface RazorpayInstance {
  open: () => void
  on: (event: "payment.failed", cb: (response: RazorpayFailure) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js"
let loading: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error("Could not load the payment window. Check your connection."))
    }
    document.body.appendChild(script)
  })
  return loading
}

export type CheckoutResult =
  | { kind: "success"; response: RazorpaySuccess }
  | { kind: "failed"; reason: string }
  | { kind: "dismissed" }

/** Opens Razorpay Checkout and resolves once the user pays, fails or closes the window. */
export async function openRazorpayCheckout(options: Omit<RazorpayOptions, "handler" | "modal">): Promise<CheckoutResult> {
  await loadScript()
  const Razorpay = window.Razorpay
  if (!Razorpay) throw new Error("Payment window unavailable")

  return new Promise<CheckoutResult>((resolve) => {
    let settled = false
    const done = (r: CheckoutResult) => {
      if (!settled) {
        settled = true
        resolve(r)
      }
    }
    const rzp = new Razorpay({
      ...options,
      handler: (response) => done({ kind: "success", response }),
      modal: { ondismiss: () => done({ kind: "dismissed" }) },
    })
    rzp.on("payment.failed", (r) => done({ kind: "failed", reason: r.error.description ?? r.error.reason ?? "Payment failed" }))
    rzp.open()
  })
}
