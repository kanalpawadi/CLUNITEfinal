import type { Metadata } from "next"
import { z } from "zod"
import { Search } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { EventCard } from "@/components/events/EventCard"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Events · Clunite",
  description: "Browse upcoming campus events and register in a few clicks.",
}

const searchSchema = z.object({ q: z.string().trim().max(100).optional().catch(undefined) })

export default async function EventsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { q } = searchSchema.parse({ q: typeof searchParams.q === "string" ? searchParams.q : undefined })
  const supabase = createClient()

  let query = supabase
    .from("events")
    .select("id, title, starts_at, venue, fee, capacity, current_participants, category, image_url, mode, club:clubs(name, slug)")
    .eq("status", "published")
    .gte("starts_at", new Date(Date.now() - 12 * 3600_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(60)
  if (q) query = query.ilike("title", `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)

  const { data: events, error } = await query

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto min-h-[70vh] max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Upcoming events</h1>
            <p className="mt-1 text-sm text-muted-foreground">Browse freely. You&apos;ll sign in when you register.</p>
          </div>
          <form role="search" className="flex w-full gap-2 sm:w-auto">
            <label htmlFor="q" className="sr-only">
              Search events
            </label>
            <Input id="q" name="q" defaultValue={q} placeholder="Search events" className="sm:w-64" />
            <Button type="submit" variant="outline" aria-label="Search">
              <Search className="h-4 w-4" aria-hidden />
            </Button>
          </form>
        </div>

        {error ? (
          <p role="alert" className="mt-10 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            We couldn&apos;t load events right now. Please refresh in a moment.
          </p>
        ) : events && events.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {q ? `No events match “${q}”.` : "No upcoming events yet. Check back soon."}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
