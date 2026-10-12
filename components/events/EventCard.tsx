import Link from "next/link"
import { CalendarDays, Clock, MapPin, Trophy, Users } from "lucide-react"
import type { Club, Event } from "@/lib/supabase"
import { formatDateTime, formatFee, formatMoney, getEventImageUrl, seatsLeft } from "@/lib/events"
import { BookmarkButton } from "./BookmarkButton"

export type EventCardData = Pick<
  Event,
  "id" | "title" | "starts_at" | "venue" | "fee" | "capacity" | "current_participants" | "category" | "image_url" | "mode"
> &
  Partial<Pick<Event, "registration_deadline" | "prize_pool">> & { club: Pick<Club, "name" | "slug"> | null }

/** Days until the registration deadline (null if none or already passed). */
function daysToDeadline(deadline: string | null | undefined, now = Date.now()): number | null {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - now
  return ms > 0 ? Math.ceil(ms / 86_400_000) : null
}

export function EventCard({
  event,
  bookmark,
}: {
  event: EventCardData
  /** Show a save button (needs to know whether the viewer is signed in and has saved it). */
  bookmark?: { saved: boolean; signedIn: boolean }
}) {
  const left = seatsLeft(event)
  const closesIn = daysToDeadline(event.registration_deadline)
  const imageUrl = getEventImageUrl(event.image_url, event.category, event.title)

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-shadow hover:shadow-soft-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={event.title}
        className="aspect-[16/7] w-full border-b border-border object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        loading="lazy"
      />
      {bookmark && (
        <div className="absolute right-3 top-3">
          <BookmarkButton eventId={event.id} title={event.title} saved={bookmark.saved} signedIn={bookmark.signedIn} />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold leading-snug text-foreground">
            <Link
              href={`/events/${event.id}`}
              className="rounded-sm after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {event.title}
            </Link>
          </h3>
          <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs tabular-nums text-foreground">
            {formatFee(event.fee)}
          </span>
        </div>
        {event.club && <p className="text-sm text-muted-foreground">by {event.club.name}</p>}
        {(closesIn !== null && closesIn <= 7) || (event.prize_pool ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {closesIn !== null && closesIn <= 7 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-warning">
                <Clock className="h-3 w-3" aria-hidden /> Closes in {closesIn} day{closesIn === 1 ? "" : "s"}
              </span>
            )}
            {(event.prize_pool ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                <Trophy className="h-3 w-3" aria-hidden /> <span className="tabular-nums">{formatMoney(event.prize_pool ?? 0)}</span> prizes
              </span>
            )}
          </div>
        ) : null}
        <ul className="mt-auto space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            <time dateTime={event.starts_at}>{formatDateTime(event.starts_at)}</time>
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {event.mode === "online" ? "Online" : (event.venue ?? "Venue TBA")}
          </li>
          {left !== null && (
            <li className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              <span className="tabular-nums">{left > 0 ? `${left} seats left` : "Full"}</span>
            </li>
          )}
        </ul>
      </div>
    </article>
  )
}
