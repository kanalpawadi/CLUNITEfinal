import type { Metadata } from "next"
import { Bell } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAuthUser } from "@/lib/auth/server"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"
import { NotificationList } from "@/components/notifications/NotificationList"

export const metadata: Metadata = { title: "Notifications · Clunite" }

export default async function NotificationsPage() {
  await requireAuthUser("/notifications")
  const supabase = createClient()
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100)

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Bell className="h-6 w-6 text-primary" aria-hidden /> Notifications
        </h1>
        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Notifications aren&apos;t available yet. Re-run supabase/schema.sql to enable them.
          </p>
        ) : (
          <NotificationList items={data ?? []} />
        )}
      </main>
      <SiteFooter />
    </>
  )
}
