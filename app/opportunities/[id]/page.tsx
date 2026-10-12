import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { ArrowLeft, CalendarClock, IndianRupee, MapPin, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getAuthUser } from "@/lib/auth/server"
import { formatDate } from "@/lib/events"
import { APPLICATION_STATUS, KIND_LABEL, MODE_LABEL, isOpen } from "@/lib/opportunities"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { Button } from "@/components/ui/button"

type Props = { params: { id: string } }

async function load(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null
  const { data } = await createClient().from("opportunities").select("*, club:clubs(name, slug)").eq("id", id).maybeSingle()
  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const o = await load(params.id)
  return { title: o ? `${o.title} at ${o.company} · Clunite` : "Opportunity · Clunite", description: o?.description.slice(0, 160) }
}

export default async function OpportunityPage({ params }: Props) {
  const o = await load(params.id)
  if (!o) notFound()
  const user = await getAuthUser()
  const { data: application } = user
    ? await createClient().from("opportunity_applications").select("status, created_at").eq("opportunity_id", o.id).eq("user_id", user.id).maybeSingle()
    : { data: null }
  const open = isOpen(o)

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/opportunities" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All opportunities
        </Link>
        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_280px]">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary">{KIND_LABEL[o.kind]}</p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{o.title}</h1>
            <p className="mt-1 text-muted-foreground">
              {o.company}
              {o.club && (
                <>
                  {" "}· posted by{" "}
                  <Link href={`/clubs/${o.club.slug}`} className="text-primary underline-offset-4 hover:underline">
                    {o.club.name}
                  </Link>
                </>
              )}
            </p>
            <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-foreground">{o.description}</div>
            {o.eligibility && (
              <section className="mt-6">
                <h2 className="text-sm font-semibold text-foreground">Who can apply</h2>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{o.eligibility}</p>
              </section>
            )}
            {o.skills.length > 0 && (
              <section className="mt-6">
                <h2 className="text-sm font-semibold text-foreground">Skills</h2>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {o.skills.map((s) => (
                    <li key={s} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{s}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <aside className="h-fit rounded-xl border border-border bg-card p-5 shadow-soft md:sticky md:top-20">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {MODE_LABEL[o.mode]}
                {o.location && ` · ${o.location}`}
              </li>
              {o.stipend && (
                <li className="flex gap-2">
                  <IndianRupee className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {o.stipend}
                </li>
              )}
              {o.openings && (
                <li className="flex gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {o.openings} opening{o.openings === 1 ? "" : "s"}
                </li>
              )}
              {o.apply_deadline && (
                <li className="flex gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Apply by {formatDate(o.apply_deadline)}
                </li>
              )}
            </ul>
            <div className="mt-5">
              {application ? (
                <div className="space-y-2">
                  <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${APPLICATION_STATUS[application.status].tone}`}>
                    {APPLICATION_STATUS[application.status].label}
                  </span>
                  <p className="text-sm text-muted-foreground">You applied on {formatDate(application.created_at)}.</p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/opportunities/${o.id}/apply`}>View application</Link>
                  </Button>
                </div>
              ) : open ? (
                <>
                  <Button asChild className="w-full">
                    <Link href={`/opportunities/${o.id}/apply`}>Apply now</Link>
                  </Button>
                  {!user && <p className="mt-2 text-xs text-muted-foreground">You&apos;ll be asked to sign in first.</p>}
                </>
              ) : (
                <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">Applications are closed.</p>
              )}
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
