"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { formatDate } from "@/lib/events"
import { effectiveStatus } from "@/lib/membership"
import { getErrorMessage } from "@/lib/utils"
import type { Enums } from "@/types/database"

export type MemberRow = {
  id: string
  role: Enums<"club_role">
  status: Enums<"membership_status">
  member_code: string | null
  joined_at: string
  expires_at: string | null
  user: { id: string; full_name: string | null; email: string } | null
  plan: { name: string } | null
}

type ViewerRole = Enums<"club_role">
const ASSIGNABLE: Enums<"club_role">[] = ["admin", "organizer", "treasurer", "member", "guest"]

/** Members, approvals and role management. RLS + the membership guard trigger enforce the same rules server-side. */
export function MembersTable({ clubId, members, viewerRole }: { clubId: string; members: MemberRow[]; viewerRole: ViewerRole }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "pending" | "staff">("all")
  const [email, setEmail] = useState("")
  const [newRole, setNewRole] = useState<Enums<"club_role">>("organizer")
  const canManageRoles = viewerRole === "owner" || viewerRole === "admin"

  const rows = useMemo(
    () =>
      members.filter((m) =>
        filter === "pending" ? m.status === "pending" : filter === "staff" ? !["member", "guest"].includes(m.role) : true,
      ),
    [members, filter],
  )
  const pendingCount = members.filter((m) => m.status === "pending").length

  const update = async (id: string, patch: { status?: Enums<"membership_status">; role?: Enums<"club_role"> }, ok: string) => {
    setBusy(id)
    const { error } = await supabase.from("club_memberships").update(patch).eq("id", id)
    setBusy(null)
    if (error) toast.error(getErrorMessage(error, "Update failed"))
    else {
      toast.success(ok)
      router.refresh()
    }
  }

  const remove = async (m: MemberRow) => {
    if (!window.confirm(`Remove ${m.user?.full_name ?? m.user?.email ?? "this member"} from the club?`)) return
    setBusy(m.id)
    const { error } = await supabase.from("club_memberships").delete().eq("id", m.id)
    setBusy(null)
    if (error) toast.error(getErrorMessage(error, "Could not remove member"))
    else {
      toast.success("Member removed")
      router.refresh()
    }
  }

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy("add")
    const { error } = await supabase.rpc("add_club_staff", { p_club_id: clubId, p_email: email.trim(), p_role: newRole })
    setBusy(null)
    if (error) toast.error(getErrorMessage(error, "Could not add staff"))
    else {
      toast.success(`${email.trim()} is now ${newRole}`)
      setEmail("")
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter members">
        {(["all", "pending", "staff"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} aria-pressed={filter === f}>
            {f === "all" ? `All (${members.length})` : f === "pending" ? `Pending (${pendingCount})` : "Staff"}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Member</th>
              <th scope="col" className="px-3 py-2 font-medium">Plan</th>
              <th scope="col" className="px-3 py-2 font-medium">Role</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium">Code</th>
              <th scope="col" className="px-3 py-2 font-medium">Expires</th>
              <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {rows.map((m) => {
              const status = effectiveStatus(m)
              const isOwner = m.role === "owner"
              return (
                <tr key={m.id}>
                  <td className="px-3 py-2">
                    <p className="text-foreground">{m.user?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                  </td>
                  <td className="px-3 py-2">{m.plan?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    {canManageRoles && !isOwner ? (
                      <select
                        aria-label={`Role for ${m.user?.full_name ?? m.user?.email ?? "member"}`}
                        value={m.role}
                        disabled={busy === m.id}
                        onChange={(e) => update(m.id, { role: e.target.value as Enums<"club_role"> }, "Role updated")}
                        className="h-8 rounded-md border border-input bg-card px-2 text-sm capitalize"
                      >
                        {ASSIGNABLE.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="capitalize">{m.role}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 capitalize">{status}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.member_code ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{m.expires_at ? formatDate(m.expires_at) : "—"}</td>
                  <td className="px-3 py-2">
                    {!isOwner && (
                      <div className="flex justify-end gap-1">
                        {busy === m.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Saving" />}
                        {m.status === "pending" && (
                          <>
                            <Button size="sm" onClick={() => update(m.id, { status: "active" }, "Member approved")} disabled={busy === m.id}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => update(m.id, { status: "cancelled" }, "Request declined")} disabled={busy === m.id}>
                              Decline
                            </Button>
                          </>
                        )}
                        {m.status === "active" && (
                          <Button size="sm" variant="ghost" onClick={() => update(m.id, { status: "suspended" }, "Member suspended")} disabled={busy === m.id}>
                            Suspend
                          </Button>
                        )}
                        {(m.status === "suspended" || status === "expired") && (
                          <Button size="sm" variant="ghost" onClick={() => update(m.id, { status: "active" }, "Member reactivated")} disabled={busy === m.id}>
                            Reactivate
                          </Button>
                        )}
                        {canManageRoles && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(m)} disabled={busy === m.id}>
                            Remove
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Nobody here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManageRoles && (
        <form onSubmit={addStaff} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="staff-email">Add staff by email</Label>
            <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="they must have an account" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-role">Role</Label>
            <select
              id="staff-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Enums<"club_role">)}
              className="h-10 rounded-md border border-input bg-card px-3 text-sm capitalize"
            >
              {(["admin", "organizer", "treasurer"] as const).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={busy === "add"}>
            {busy === "add" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="mr-2 h-4 w-4" aria-hidden />}
            Add
          </Button>
        </form>
      )}
    </div>
  )
}
