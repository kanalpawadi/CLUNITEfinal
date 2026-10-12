import type { Metadata } from "next"
import Link from "next/link"
import { Briefcase, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { likeEscape } from "@/lib/discovery"
import { opportunityFilters } from "@/lib/opportunities"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { OpportunityCard } from "@/components/opportunities/OpportunityCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const metadata: Metadata = {
  title: "Internships & jobs · Clunite",
  description: "Internships and jobs posted by campus clubs and partners.",
}

const selectClass = "h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground"

export default async function OpportunitiesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const f = opportunityFilters.parse(searchParams)
  const supabase = createClient()
  let query = supabase
    .from("opportunities")
    .select("id, kind, title, company, location, mode, stipend, skills, apply_deadline, status")
    .eq("status", "published")
    .or(`apply_deadline.is.null,apply_deadline.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(60)
  if (f.kind) query = query.eq("kind", f.kind)
  if (f.mode) query = query.eq("mode", f.mode)
  if (f.q) {
    const term = likeEscape(f.q).replace(/[,()]/g, " ")
    query = query.or(`title.ilike.%${term}%,company.ilike.%${term}%`)
  }
  const { data, error } = await query
  const filtering = !!(f.q || f.kind || f.mode)

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto min-h-[70vh] max-w-6xl px-4 py-10">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Briefcase className="h-6 w-6 text-primary" aria-hidden /> Internships &amp; jobs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Open roles from campus clubs and partners. Sign in to apply.</p>

        <form role="search" aria-label="Filter opportunities" className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 shadow-soft sm:grid-cols-[1fr_auto_auto_auto]">
          <label htmlFor="q" className="sr-only">Search</label>
          <Input id="q" name="q" defaultValue={f.q} placeholder="Role or company" />
          <label className="sr-only" htmlFor="kind">Type</label>
          <select id="kind" name="kind" defaultValue={f.kind ?? ""} className={selectClass}>
            <option value="">Internships &amp; jobs</option>
            <option value="internship">Internships</option>
            <option value="job">Jobs</option>
          </select>
          <label className="sr-only" htmlFor="mode">Mode</label>
          <select id="mode" name="mode" defaultValue={f.mode ?? ""} className={selectClass}>
            <option value="">Any location</option>
            <option value="remote">Remote</option>
            <option value="onsite">On-site</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" aria-hidden /> Search
            </Button>
            {filtering && (
              <Button asChild variant="ghost">
                <Link href="/opportunities">Clear</Link>
              </Button>
            )}
          </div>
        </form>

        {error ? (
          <p role="alert" className="mt-8 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Opportunities aren&apos;t available yet. Re-run supabase/schema.sql to enable them.
          </p>
        ) : data && data.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((o) => (
              <OpportunityCard key={o.id} o={o} />
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {filtering ? "No roles match these filters." : "No open roles right now. Check back soon."}
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
