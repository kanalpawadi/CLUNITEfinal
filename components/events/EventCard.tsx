import Link from "next/link"
import { CalendarDays, MapPin, Users } from "lucide-react"
import type { Club, Event } from "@/lib/supabase"
import { formatDateTime, formatFee, seatsLeft } from "@/lib/events"

export type EventCardData = Pick<
  Event,
  "id" | "title" | "starts_at" | "venue" | "fee" | "capacity" | "current_participants" | "category" | "image_url" | "mode"
> & { club: Pick<Club, "name" | "slug"> | null }

export function EventCard({ event }: { event: EventCardData }) {
  const left = seatsLeft(event)
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-shadow hover:shadow-soft-lg">
      {event.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.image_url} alt="" className="aspect-[16/7] w-full border-b border-border object-cover" loading="lazy" />
      ) : (
        <div aria-hidden className="flex aspect-[16/7] items-end border-b border-border bg-muted p-4 font-mono text-xs text-muted-foreground">
          {`> ${event.category ?? "event"}`}
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
