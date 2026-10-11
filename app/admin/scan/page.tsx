import type { Metadata } from "next"
import { ShieldAlert } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getStaffMemberships } from "@/lib/auth/server"
import { Scanner, type ScannableEvent } from "@/components/scanner/Scanner"

export const metadata: Metadata = { title: "Scan QR · Clunite" }

const SCAN_ROLES = new Set(["owner", "admin", "organizer"])

export default async function ScanPage({ searchParams }: { searchParams: { event?: string } }) {
  // Server-side role gate: scanning is for owners, admins and organizers (treasurers can't)
  const clubIds = (await getStaffMemberships()).filter((m) => SCAN_ROLES.has(m.role)).map((m) => m.club_id)
  if (clubIds.length === 0) {
    return (
      <main id="main" className="mx-auto max-w-md py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Scanning is for organizers</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ask a club owner or admin to give you the organizer role.</p>
      </main>
    )
  }

  const supabase = createClient()
  const now = Date.now()
  const { data: rows } = await supabase
    .from("events")
    .select("id, title, starts_at, club:clubs(name), attendance(count)")
    .in("club_id", clubIds)
    .in("status", ["published", "completed"])
    .gte("starts_at", new Date(now - 24 * 3600_000).toISOString())
    .lte("starts_at", new Date(now + 2 * 24 * 3600_000).toISOString())
    .order("starts_at")

  const events: ScannableEvent[] = (rows ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    clubName: e.club?.name ?? "",
    startsAt: e.starts_at,
    attendance: e.attendance[0]?.count ?? 0,
  }))

  return (
    <main id="main">
      <h1 className="text-2xl font-semibold text-foreground">Scan member QR</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Pick the event, start the camera and point it at a member&apos;s ID card.</p>
      <Scanner events={events} initialEventId={searchParams.event} />
    </main>
  )
}
