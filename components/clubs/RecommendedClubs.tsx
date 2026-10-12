import Link from "next/link"
import { Sparkles, Users } from "lucide-react"
import type { Recommendation } from "@/lib/interests"

/** Grid of recommended clubs with the reasons they matched. */
export function RecommendedClubs({ items, emptyText }: { items: Recommendation[]; emptyText?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText ?? "No new clubs to suggest right now."}</p>
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((club) => (
        <li key={club.id} className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-soft-lg">
          <div className="flex items-start gap-3">
            {club.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={club.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover" />
            ) : (
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-primary">
                {club.name.charAt(0)}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold leading-snug text-foreground">
                <Link
                  href={`/clubs/${club.slug}`}
                  className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {club.name}
                </Link>
              </h3>
              {club.tagline && <p className="line-clamp-2 text-sm text-muted-foreground">{club.tagline}</p>}
            </div>
          </div>
          {club.reasons.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Matches:</span>
              {club.reasons.map((r) => (
                <span key={r} className="rounded-full bg-primary/10 px-2 py-0.5">
                  {r}
                </span>
              ))}
            </p>
          )}
          <p className="mt-auto flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden /> {club.members_count} members · {club.events_hosted_count} events
            {club.category && ` · ${club.category}`}
          </p>
        </li>
      ))}
    </ul>
  )
}
