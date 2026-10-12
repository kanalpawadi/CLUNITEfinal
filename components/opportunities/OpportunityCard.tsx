import Link from "next/link"
import { CalendarClock, IndianRupee, MapPin } from "lucide-react"
import { formatDate } from "@/lib/events"
import { KIND_LABEL, MODE_LABEL, isOpen, type Opportunity } from "@/lib/opportunities"

export type OpportunityCardData = Pick<
  Opportunity,
  "id" | "kind" | "title" | "company" | "location" | "mode" | "stipend" | "skills" | "apply_deadline" | "status"
>

export function OpportunityCard({ o }: { o: OpportunityCardData }) {
  const open = isOpen(o)
  return (
    <article className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-soft-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-primary">{KIND_LABEL[o.kind]}</p>
          <h3 className="mt-0.5 font-semibold leading-snug text-foreground">
            <Link href={`/opportunities/${o.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {o.title}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">{o.company}</p>
        </div>
        {!open && <span className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">Closed</span>}
      </div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden /> {MODE_LABEL[o.mode]}
          {o.location && ` · ${o.location}`}
        </li>
        {o.stipend && (
          <li className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 shrink-0" aria-hidden /> {o.stipend}
          </li>
        )}
        {o.apply_deadline && (
          <li className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden /> Apply by {formatDate(o.apply_deadline)}
          </li>
        )}
      </ul>
      {o.skills.length > 0 && (
        <ul aria-label="Skills" className="mt-auto flex flex-wrap gap-1.5">
          {o.skills.slice(0, 6).map((s) => (
            <li key={s} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {s}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
