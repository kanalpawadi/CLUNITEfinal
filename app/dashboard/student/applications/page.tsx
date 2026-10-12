import type { Metadata } from "next"
import Link from "next/link"
import { Briefcase } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAuthUser } from "@/lib/auth/server"
import { formatDate } from "@/lib/events"
import { APPLICATION_STATUS, KIND_LABEL } from "@/lib/opportunities"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "My applications · Clunite" }

export default async function ApplicationsPage() {
  const user = await requireAuthUser("/dashboard/student/applications")
  const { data } = await createClient()
    .from("opportunity_applications")
    .select("id, status, created_at, opportunity:opportunities(id, kind, title, company)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Briefcase className="h-6 w-6 text-primary" aria-hidden /> My applications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Internships and jobs you&apos;ve applied for.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/opportunities">Browse roles</Link>
        </Button>
      </header>
      {data && data.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{a.opportunity ? KIND_LABEL[a.opportunity.kind] : ""}</p>
                <Link href={`/opportunities/${a.opportunity?.id}/apply`} className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline">
                  {a.opportunity?.title ?? "Role"}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {a.opportunity?.company} · applied {formatDate(a.created_at)}
                </p>
              </div>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${APPLICATION_STATUS[a.status].tone}`}>
                {APPLICATION_STATUS[a.status].label}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No applications yet.</p>
      )}
    </div>
  )
}
