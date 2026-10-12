"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell } from "lucide-react"
import { supabase } from "@/lib/supabase"

/** Bell with unread count; refreshes on navigation and every 60s while visible. */
export function NotificationBell() {
  const pathname = usePathname()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null)
      if (!cancelled) setUnread(count ?? 0)
    }
    void load()
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [pathname])

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unread > 0 && (
        <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-[18px] text-primary-foreground tabular-nums">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  )
}
