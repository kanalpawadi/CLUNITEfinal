import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getProfile, requireAuthUser } from "@/lib/auth/server"
import { formatDateTime } from "@/lib/events"
import { APPLICATION_STATUS, isOpen } from "@/lib/opportunities"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { ApplyForm, WithdrawButton } from "@/components/opportunities/ApplyForm"

export const metadata: Metadata = { title: "Apply · Clunite" }

export default async function ApplyPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  const user = await requireAuthUser(`/opportunities/${params.id}/apply`)
  const supabase = createClient()
  const [{ data: o }, { data: application }, profile] = await Promise.all([
    supabase.from("opportunities").select("id, title, company, status, apply_deadline").eq("id", params.id).maybeSingle(),
    supabase.from("opportunity_applications").select("*").eq("opportunity_id", params.id).eq("user_id", user.id).maybeSingle(),
    getProfile(),
  ])
  if (!o) notFound()

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-2xl px-4 py-10">
        <Link href={`/opportunities/${o.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">{o.title}</h1>
        <p className="text-muted-foreground">{o.company}</p>
        <div className="mt-8 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
          {application ? (
            <div className="space-y-4">
              <span className={`inline-block rounded-md border px-2 py-0.5 text-sm font-medium ${APPLICATION_STATUS[application.status].tone}`}>
                {APPLICATION_STATUS[application.status].label}
              </span>
              <p className="text-sm text-muted-foreground">Submitted {formatDateTime(application.created_at)}. You&apos;ll get a notification when the status changes.</p>
              {application.cover_note && <p className="whitespace-pre-line rounded-lg bg-muted p-3 text-sm text-foreground">{application.cover_note}</p>}
              {application.status === "applied" && <WithdrawButton applicationId={application.id} resumePath={application.resume_path} />}
            </div>
          ) : isOpen(o) ? (
            <ApplyForm opportunityId={o.id} userId={user.id} defaultPhone={profile?.phone ?? ""} />
          ) : (
            <p className="text-sm text-muted-foreground">Applications for this role are closed.</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
