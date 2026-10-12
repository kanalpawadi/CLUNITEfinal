import type { Metadata } from "next"
import Link from "next/link"
import { Users } from "lucide-react"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireAuthUser } from "@/lib/auth/server"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { JoinTeamForm } from "@/components/teams/JoinTeamForm"

export const metadata: Metadata = { title: "Join a team · Clunite" }

const codeSchema = z.string().trim().toUpperCase().regex(/^T-[A-Z2-9]{8}$/)

export default async function JoinTeamPage({ searchParams }: { searchParams: { code?: string } }) {
  const parsed = codeSchema.safeParse(searchParams.code ?? "")
  await requireAuthUser(`/teams/join${parsed.success ? `?code=${parsed.data}` : ""}`)
  const supabase = createClient()
  const preview = parsed.success ? (await supabase.rpc("preview_team_invite", { p_code: parsed.data })).data?.[0] : undefined

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Users className="h-5 w-5 text-primary" aria-hidden /> Join a team
          </h1>
          {preview ? (
            <>
              <p className="mt-3 text-sm text-foreground">
                {preview.lead_first_name} invited you to <span className="font-semibold">{preview.team_name ?? "their team"}</span> for{" "}
                <Link href={`/events/${preview.event_id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                  {preview.event_title}
                </Link>
                .
              </p>
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                {preview.members}/{preview.capacity} members so far
              </p>
              <div className="mt-6">
                {preview.members >= preview.capacity ? (
                  <p className="text-sm text-destructive">This team is already full.</p>
                ) : (
                  <JoinTeamForm code={parsed.success ? parsed.data : ""} eventId={preview.event_id} />
                )}
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                {searchParams.code ? "That invite link is invalid or has expired." : "Enter the invite code your team lead shared."}
              </p>
              <div className="mt-6">
                <JoinTeamForm code="" eventId={null} />
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
