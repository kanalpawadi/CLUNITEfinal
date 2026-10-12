"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { loginUrl } from "@/lib/auth/redirect"
import { getErrorMessage } from "@/lib/utils"

const base =
  "relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** Save/unsave an event. Visitors are sent to sign in and brought back. */
export function BookmarkButton({ eventId, title, saved, signedIn }: { eventId: string; title: string; saved: boolean; signedIn: boolean }) {
  const router = useRouter()
  const [on, setOn] = useState(saved)
  const [busy, setBusy] = useState(false)

  if (!signedIn) {
    return (
      <Link href={loginUrl("/events", "auth_required")} className={base} aria-label={`Sign in to save ${title}`}>
        <Bookmark className="h-4 w-4" aria-hidden />
      </Link>
    )
  }

  const toggle = async () => {
    setBusy(true)
    const next = !on
    setOn(next)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Please sign in again")
      const { error } = next
        ? await supabase.from("event_bookmarks").insert({ user_id: user.id, event_id: eventId })
        : await supabase.from("event_bookmarks").delete().eq("user_id", user.id).eq("event_id", eventId)
      if (error && error.code !== "23505") throw error
      toast.success(next ? "Saved" : "Removed from saved")
      router.refresh()
    } catch (err) {
      setOn(!next)
      toast.error(getErrorMessage(err, "Could not update"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} aria-label={on ? `Remove ${title} from saved` : `Save ${title}`} className={base}>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : on ? (
        <BookmarkCheck className="h-4 w-4 text-primary" aria-hidden />
      ) : (
        <Bookmark className="h-4 w-4" aria-hidden />
      )}
    </button>
  )
}
