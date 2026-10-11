import Link from "next/link"
import type { ReactNode } from "react"

/** Centered card layout shared by every auth screen. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link
        href="/"
        className="mb-8 rounded-md text-sm font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span aria-hidden className="text-primary">
          ›_
        </span>{" "}
        clunite
      </Link>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
    </main>
  )
}

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground" role="separator">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

export function AuthAlert({ tone, children }: { tone: "info" | "error" | "success"; children: ReactNode }) {
  const styles = {
    info: "border-border bg-muted text-foreground",
    error: "border-destructive/40 bg-destructive/10 text-destructive",
    success: "border-success/40 bg-success/10 text-success",
  } as const
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles[tone]}`}>
      {children}
    </div>
  )
}
