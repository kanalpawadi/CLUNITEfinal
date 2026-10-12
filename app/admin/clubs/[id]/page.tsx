import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getStaffMemberships, isSuperAdmin } from "@/lib/auth/server"
import { formatDateTime, formatMoney } from "@/lib/events"
import { MembersTable, type MemberRow } from "@/components/admin/MembersTable"
import { ClubSettings, PlansEditor } from "@/components/admin/PlansEditor"
import { ClubSignatories } from "@/components/admin/ClubSignatories"
import type { Enums } from "@/types/database"

export const metadata: Metadata = { title: "Manage club · Clunite" }

export default async function AdminClubPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()

  // Server-side role check for THIS club (RLS repeats it for every query below)
  const [memberships, superAdmin] = await Promise.all([getStaffMemberships(), isSuperAdmin()])
  const mine = memberships.find((m) => m.club_id === params.id)
  if (!mine && !superAdmin) notFound()
  const role: Enums<"club_role"> = mine?.role ?? "owner"
  const canEdit = role === "owner" || role === "admin"
  const canSeeMoney = canEdit || role === "treasurer"
  const canManageMembers = role !== "treasurer"

  const supabase = createClient()
  const [{ data: club }, { data: members }, { data: plans }, { data: events }, { data: payments }] = await Promise.all([
    supabase.from("clubs").select("id, name, slug, requires_approval, members_count, faculty_in_charge, hod_name").eq("id", params.id).maybeSingle(),
    supabase
      .from("club_memberships")
      .select("id, role, status, member_code, joined_at, expires_at, user:users!club_memberships_user_id_fkey(id, full_name, email), plan:membership_plans(name)")
      .eq("club_id", params.id)
      .order("status")
      .order("joined_at", { ascending: false }),
    supabase.from("membership_plans").select("*").eq("club_id", params.id).order("price"),
    supabase
      .from("events")
      .select("id, title, starts_at, status, current_participants, capacity, fee")
      .eq("club_id", params.id)
      .order("starts_at", { ascending: false })
      .limit(20),
    canSeeMoney
      ? supabase
          .from("payments")
          .select("id, amount, currency, status, purpose, created_at, receipt_no, payer:users!payments_user_id_fkey(full_name, email)")
          .eq("club_id", params.id)
          .order("created_at", { ascending: false })
          .limit(25)
      : Promise.resolve({ data: null }),
  ])
  if (!club) notFound()

  const paidTotal = (payments ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0)

  return (
    <main id="main" className="space-y-10">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Club admin · {role}</p>
          <h1 className="text-2xl font-semibold text-foreground">{club.name}</h1>
        </div>
        <nav aria-label="Sections" className="flex flex-wrap gap-3 text-sm">
          <a href="#members" className="text-primary underline-offset-4 hover:underline">Members</a>
          <a href="#plans" className="text-primary underline-offset-4 hover:underline">Plans</a>
          <a href="#events" className="text-primary underline-offset-4 hover:underline">Events</a>
          {canSeeMoney && <a href="#payments" className="text-primary underline-offset-4 hover:underline">Payments</a>}
          <Link href={`/clubs/${club.slug}`} className="text-muted-foreground underline-offset-4 hover:underline">Public page</Link>
        </nav>
      </header>

      <section id="members" aria-labelledby="members-h" className="space-y-4">
        <h2 id="members-h" className="text-lg font-semibold text-foreground">Members</h2>
        <ClubSettings club={club} canEdit={canEdit} />
        {canManageMembers ? (
          <MembersTable clubId={club.id} members={(members ?? []) as MemberRow[]} viewerRole={role} />
        ) : (
          <p className="text-sm text-muted-foreground tabular-nums">{club.members_count} active members.</p>
        )}
      </section>

      <section id="certificates" aria-labelledby="cert-h" className="space-y-4">
        <h2 id="cert-h" className="text-lg font-semibold text-foreground">Certificate signatories</h2>
        <p className="text-sm text-muted-foreground">Printed on every participation certificate for this club&apos;s events.</p>
        <ClubSignatories club={club} canEdit={canEdit} />
      </section>

      <section id="plans" aria-labelledby="plans-h" className="space-y-4">
        <h2 id="plans-h" className="text-lg font-semibold text-foreground">Membership plans</h2>
        <PlansEditor clubId={club.id} plans={plans ?? []} canEdit={canEdit} />
      </section>

      <section id="events" aria-labelledby="events-h" className="space-y-4">
        <h2 id="events-h" className="text-lg font-semibold text-foreground">Events</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Event</th>
                <th scope="col" className="px-3 py-2 font-medium">Starts</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Registered</th>
                <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Links</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {(events ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 text-foreground">{e.title}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDateTime(e.starts_at)}</td>
                  <td className="px-3 py-2 capitalize">{e.status}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {e.current_participants}
                    {e.capacity ? ` / ${e.capacity}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-3">
                      <Link href={`/admin/events/${e.id}/attendance`} className="text-primary underline-offset-4 hover:underline">Attendance</Link>
                      <Link href={`/dashboard/organizer/events/${e.id}/participants`} className="text-muted-foreground underline-offset-4 hover:underline">Participants</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {(events ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No events yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canSeeMoney && (
        <section id="payments" aria-labelledby="payments-h" className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 id="payments-h" className="text-lg font-semibold text-foreground">Recent payments</h2>
            <p className="text-sm text-muted-foreground">
              Collected: <span className="font-semibold tabular-nums text-foreground">{formatMoney(paidTotal)}</span>
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">When</th>
                  <th scope="col" className="px-3 py-2 font-medium">Payer</th>
                  <th scope="col" className="px-3 py-2 font-medium">For</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {(payments ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 tabular-nums">{formatDateTime(p.created_at)}</td>
                    <td className="px-3 py-2">{p.payer?.full_name ?? p.payer?.email ?? "—"}</td>
                    <td className="px-3 py-2 capitalize">{p.purpose}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/payments/${p.id}`} className="capitalize text-primary underline-offset-4 hover:underline">
                        {p.status}
                      </Link>
                    </td>
                  </tr>
                ))}
                {(payments ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No payments yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}
