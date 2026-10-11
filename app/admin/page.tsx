import type { Metadata } from "next"
import Link from "next/link"
import { getStaffMemberships } from "@/lib/auth/server"

export const metadata: Metadata = { title: "Admin · Clunite" }

export default async function AdminHome() {
  const memberships = await getStaffMemberships()
  return (
    <main id="main">
      <h1 className="text-2xl font-semibold text-foreground">Club admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">Clubs where you hold a staff role.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.map((m) => (
          <li key={m.club_id} className="relative rounded-xl border border-border bg-card p-4 shadow-soft">
            <h2 className="font-semibold text-foreground">
              <Link href={`/admin/clubs/${m.club_id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {m.club.name}
              </Link>
            </h2>
            <p className="mt-1 text-sm capitalize text-muted-foreground">{m.role}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
