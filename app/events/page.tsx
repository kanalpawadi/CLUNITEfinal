import type { Metadata } from "next"
import Link from "next/link"
import { Clock, Flame, Search, SlidersHorizontal } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getAuthUser } from "@/lib/auth/server"
import { EVENT_MODES, EVENT_TYPES, SORTS, hasActiveFilters, likeEscape, parseFilters } from "@/lib/discovery"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { EventCard } from "@/components/events/EventCard"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Events · Clunite",
  description: "Discover hackathons, workshops and competitions. Filter by type, prize, mode and deadline.",
}

const CARD_FIELDS =
  "id, title, starts_at, venue, fee, capacity, current_participants, category, image_url, mode, registration_deadline, prize_pool, club:clubs(name, slug)"

const selectClass = "h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground"

export default async function EventsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const f = parseFilters(searchParams)
  const supabase = createClient()
  const user = await getAuthUser()
  const nowIso = new Date().toISOString()
  const filtering = hasActiveFilters(f)

  let query = supabase
    .from("events")
    .select(CARD_FIELDS)
    .eq("status", "published")
    .gte("starts_at", new Date(Date.now() - 12 * 3600_000).toISOString())
    .limit(60)
  if (f.q) {
    // commas/parentheses would break PostgREST's or() syntax
    const term = likeEscape(f.q).replace(/[,()]/g, " ")
    query = query.or(`title.ilike.%${term}%,category.ilike.%${term}%`)
  }
  if (f.type) query = query.eq("type", f.type)
  if (f.mode) query = query.eq("mode", f.mode)
  if (f.category) query = query.ilike("category", likeEscape(f.category))
  if (f.price === "free") query = query.eq("fee", 0)
  if (f.price === "paid") query = query.gt("fee", 0)
  if (f.prize) query = query.gt("prize_pool", 0)
  if (f.closing) {
    query = query
      .gte("registration_deadline", nowIso)
      .lte("registration_deadline", new Date(Date.now() + Number(f.closing) * 86_400_000).toISOString())
  }
  query =
    f.sort === "closing"
      ? query.not("registration_deadline", "is", null).gte("registration_deadline", nowIso).order("registration_deadline")
      : f.sort === "trending"
        ? query.order("views", { ascending: false })
        : f.sort === "prize"
          ? query.order("prize_pool", { ascending: false, nullsFirst: false })
          : query.order("starts_at")

  const [{ data: events, error }, closingSoon, trending, { data: categories }, { data: saved }] = await Promise.all([
    query,
    filtering
      ? Promise.resolve({ data: null })
      : supabase
          .from("events")
          .select(CARD_FIELDS)
          .eq("status", "published")
          .gte("registration_deadline", nowIso)
          .lte("registration_deadline", new Date(Date.now() + 3 * 86_400_000).toISOString())
          .order("registration_deadline")
          .limit(3),
    filtering
      ? Promise.resolve({ data: null })
      : supabase
          .from("events")
          .select(CARD_FIELDS)
          .eq("status", "published")
          .gte("starts_at", nowIso)
          .gt("views", 0)
          .order("views", { ascending: false })
          .limit(3),
    supabase.from("events").select("category").eq("status", "published").not("category", "is", null).limit(500),
    user
      ? supabase.from("event_bookmarks").select("event_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { event_id: string }[] }),
  ])

  const savedIds = new Set((saved ?? []).map((b) => b.event_id))
  const bookmark = (id: string) => ({ saved: savedIds.has(id), signedIn: !!user })
  const categoryOptions = Array.from(
    new Set((categories ?? []).map((c) => c.category).filter((c): c is string => !!c)),
  ).sort()

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto min-h-[70vh] max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Discover events</h1>
          <p className="text-sm text-muted-foreground">
            Hackathons, workshops and competitions. Browse freely; you&apos;ll sign in when you register.
          </p>
        </div>

        <form role="search" aria-label="Filter events" className="mt-6 space-y-3 rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="flex gap-2">
            <label htmlFor="q" className="sr-only">
              Search events
            </label>
            <Input id="q" name="q" defaultValue={f.q} placeholder="Search by title or category" />
            <Button type="submit" aria-label="Apply filters">
              <Search className="h-4 w-4 sm:mr-2" aria-hidden />
              <span className="hidden sm:inline">Search</span>
            </Button>
          </div>
          <details open={filtering}>
            <summary className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters &amp; sort
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Type</span>
                <select name="type" defaultValue={f.type ?? ""} className={`${selectClass} w-full capitalize`}>
                  <option value="">Any type</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Category</span>
                <select name="category" defaultValue={f.category ?? ""} className={`${selectClass} w-full`}>
                  <option value="">Any category</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Mode</span>
                <select name="mode" defaultValue={f.mode ?? ""} className={`${selectClass} w-full capitalize`}>
                  <option value="">Online or offline</option>
                  {EVENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Price</span>
                <select name="price" defaultValue={f.price ?? ""} className={`${selectClass} w-full`}>
                  <option value="">Free or paid</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Deadline</span>
                <select name="closing" defaultValue={f.closing ?? ""} className={`${selectClass} w-full`}>
                  <option value="">Any deadline</option>
                  <option value="3">Closing in 3 days</option>
                  <option value="7">Closing in 7 days</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Sort by</span>
                <select name="sort" defaultValue={f.sort} className={`${selectClass} w-full`}>
                  {Object.entries(SORTS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
                <input type="checkbox" name="prize" value="1" defaultChecked={!!f.prize} className="h-4 w-4 accent-primary" />
                Has prizes
              </label>
              <div className="flex items-end gap-2">
                <Button type="submit" variant="outline" className="flex-1">
                  Apply
                </Button>
                {filtering && (
                  <Button asChild variant="ghost">
                    <Link href="/events">Clear</Link>
                  </Button>
                )}
              </div>
            </div>
          </details>
        </form>

        {closingSoon.data && closingSoon.data.length > 0 && (
          <section aria-labelledby="closing" className="mt-10">
            <h2 id="closing" className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Clock className="h-5 w-5 text-warning" aria-hidden /> Closing soon
            </h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {closingSoon.data.map((e) => (
                <EventCard key={e.id} event={e} bookmark={bookmark(e.id)} />
              ))}
            </div>
          </section>
        )}
        {trending.data && trending.data.length > 0 && (
          <section aria-labelledby="trending" className="mt-10">
            <h2 id="trending" className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Flame className="h-5 w-5 text-primary" aria-hidden /> Trending
            </h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {trending.data.map((e) => (
                <EventCard key={e.id} event={e} bookmark={bookmark(e.id)} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="all" className="mt-10">
          <h2 id="all" className="text-lg font-semibold text-foreground">
            {filtering ? `Results${events ? ` (${events.length})` : ""}` : "All upcoming events"}
          </h2>
          {error ? (
            <p role="alert" className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              We couldn&apos;t load events right now. Please refresh in a moment.
            </p>
          ) : events && events.length > 0 ? (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} bookmark={bookmark(event.id)} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {filtering ? "No events match these filters." : "No upcoming events yet. Check back soon."}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
