import type { ReactNode } from "react"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { getStaffMemberships, isSuperAdmin, requireAuthUser } from "@/lib/auth/server"
import { SiteHeader } from "@/components/site/SiteHeader"
import { Button } from "@/components/ui/button"

/**
 * Server-side gate for /admin/*: signed in AND staff of at least one club (or super admin).
 * Each page re-checks the specific club role, and RLS enforces it again in the database.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAuthUser()
  const [memberships, superAdmin] = await Promise.all([getStaffMemberships(), isSuperAdmin()])

  if (memberships.length === 0 && !superAdmin) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Club staff only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is for club owners, admins, organizers and treasurers.
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </main>
      </>
    )
  }

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <nav aria-label="Admin" className="mb-6 flex flex-wrap gap-2 text-sm">
          <Link href="/admin" className="rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground">
            Overview
          </Link>
          <Link href="/admin/scan" className="rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground">
            Scan QR
          </Link>
        </nav>
        {children}
      </div>
    </>
  )
}
