"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase, type Tables } from "@/lib/supabase"
import { formatDateTime } from "@/lib/events"
import { getErrorMessage } from "@/lib/utils"

type Item = Pick<Tables<"notifications">, "id" | "title" | "body" | "link" | "read_at" | "created_at">

export function NotificationList({ items }: { items: Item[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const unread = items.filter((n) => !n.read_at).length

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids)
    if (error) toast.error(getErrorMessage(error))
    else router.refresh()
  }
  const remove = async (id: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id)
    if (error) toast.error(getErrorMessage(error))
    else router.refresh()
  }

  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
  }

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await markRead(items.filter((n) => !n.read_at).map((n) => n.id))
            setBusy(false)
          }}
        >
          <CheckCheck className="mr-2 h-4 w-4" aria-hidden /> Mark all as read
        </Button>
      )}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((n) => (
          <li key={n.id} className={`flex gap-3 px-4 py-3 ${n.read_at ? "" : "bg-primary/5"}`}>
            <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-primary"}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">
                <span className="sr-only">{n.read_at ? "" : "Unread: "}</span>
                {n.link ? (
                  <Link href={n.link} onClick={() => !n.read_at && void markRead([n.id])} className="underline-offset-4 hover:text-primary hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )}
              </p>
              {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">{formatDateTime(n.created_at)}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove(n.id)} aria-label={`Delete notification: ${n.title}`}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
