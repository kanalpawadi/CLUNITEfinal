import type { Metadata } from "next"
import Link from "next/link"
import { Bookmark } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAuthUser } from "@/lib/auth/server"
import { EventCard } from "@/components/events/EventCard"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Saved · Clunite" }

export default async function SavedPage() {
  const user = await requireAuthUser("/dashboard/student/saved")
  const supabase = createClient()
  const { data } = await supabase
    .from("event_bookmarks")
    .select(
      "created_at, event:events(id, title, starts_at, venue, fee, capacity, current_participants, category, image_url, mode, registration_deadline, prize_pool, status, club:clubs(name, slug))",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const events = (data ?? []).flatMap((b) => (b.event ? [b.event] : []))
  const upcoming = events.filter((e) => new Date(e.starts_at) >= new Date(Date.now() - 12 * 3600_000))
  const past = events.filter((e) => !upcoming.includes(e))

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Bookmark className="h-6 w-6 text-primary" aria-hidden /> Saved events
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Events you bookmarked. Register before the deadline!</p>
      </header>
      {events.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Nothing saved yet. Tap the bookmark on any event to keep it here.</p>
          <Button asChild className="mt-4">
            <Link href="/events">Discover events</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => <EventCard key={e.id} event={e} bookmark={{ saved: true, signedIn: true }} />)}
          </div>
          {past.length > 0 && (
            <section aria-labelledby="past" className="space-y-4">
              <h2 id="past" className="text-lg font-semibold text-foreground">Past</h2>
              <div className="grid gap-5 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((e) => <EventCard key={e.id} event={e} bookmark={{ saved: true, signedIn: true }} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
