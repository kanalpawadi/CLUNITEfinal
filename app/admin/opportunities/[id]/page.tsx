import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { APPLICATION_STATUS } from "@/lib/opportunities"
import { ApplicantsTable, OpportunityForm, type ApplicantRow } from "@/components/opportunities/OpportunityAdmin"

export const metadata: Metadata = { title: "Applicants · Clunite" }

export default async function OpportunityAdminPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  const supabase = createClient()
  // RLS returns drafts/applications only to the posting club's owner/admin (or a super admin)
  const { data: o } = await supabase.from("opportunities").select("*").eq("id", params.id).maybeSingle()
  if (!o) notFound()
  const { data: canManage } = await supabase.rpc("can_manage_opportunity", { p_club_id: o.club_id ?? "00000000-0000-0000-0000-000000000000" })
  if (!canManage) notFound()

  const { data: apps } = await supabase
    .from("opportunity_applications")
    .select("id, status, created_at, cover_note, phone, portfolio_url, resume_path, user:users!opportunity_applications_user_id_fkey(full_name, email, college)")
    .eq("opportunity_id", o.id)
    .order("created_at")
  const rows: ApplicantRow[] = apps ?? []
  const counts = rows.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {})

  return (
    <main id="main" className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{o.company}</p>
          <h1 className="text-2xl font-semibold text-foreground">{o.title}</h1>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">
            {rows.length} applicants ·{" "}
            {(Object.keys(APPLICATION_STATUS) as (keyof typeof APPLICATION_STATUS)[])
              .map((s) => `${counts[s] ?? 0} ${APPLICATION_STATUS[s].label.toLowerCase()}`)
              .join(" · ")}
          </p>
        </div>
        <Link href={`/opportunities/${o.id}`} className="text-sm text-primary underline-offset-4 hover:underline">Public page</Link>
      </header>
      <section aria-labelledby="apps-h" className="space-y-3">
        <h2 id="apps-h" className="text-lg font-semibold text-foreground">Applicants</h2>
        <ApplicantsTable rows={rows} />
      </section>
      <section aria-labelledby="edit-h" className="space-y-3">
        <h2 id="edit-h" className="text-lg font-semibold text-foreground">Edit posting</h2>
        {o.club_id && <OpportunityForm clubId={o.club_id} opportunity={o} />}
      </section>
    </main>
  )
}
