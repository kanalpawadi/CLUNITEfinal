import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { hasClubRole, isSuperAdmin } from "@/lib/auth/server"
import { formatDate } from "@/lib/events"
import { KIND_LABEL } from "@/lib/opportunities"
import { OpportunityForm } from "@/components/opportunities/OpportunityAdmin"

export const metadata: Metadata = { title: "Opportunities · Clunite" }

export default async function ClubOpportunitiesPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  const allowed = (await hasClubRole(params.id, ["owner", "admin"])) || (await isSuperAdmin())
  if (!allowed) notFound()
  const supabase = createClient()
  const [{ data: club }, { data: rows }] = await Promise.all([
    supabase.from("clubs").select("id, name").eq("id", params.id).maybeSingle(),
    supabase
      .from("opportunities")
      .select("id, kind, title, company, status, apply_deadline, opportunity_applications(count)")
      .eq("club_id", params.id)
      .order("created_at", { ascending: false }),
  ])
  if (!club) notFound()

  return (
    <main id="main" className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{club.name}</p>
        <h1 className="text-2xl font-semibold text-foreground">Internships &amp; jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Post roles for students; review applications and résumés.</p>
      </header>

      {rows && rows.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link href={`/admin/opportunities/${o.id}`} className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline">
                  {o.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {KIND_LABEL[o.kind]} · {o.company}
                  {o.apply_deadline && ` · apply by ${formatDate(o.apply_deadline)}`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="tabular-nums text-muted-foreground">{o.opportunity_applications[0]?.count ?? 0} applicants</span>
                <span className="rounded-md border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">{o.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="new-h" className="space-y-3">
        <h2 id="new-h" className="text-lg font-semibold text-foreground">Post a new role</h2>
        <OpportunityForm clubId={club.id} />
      </section>
    </main>
  )
}
