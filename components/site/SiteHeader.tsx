import Link from "next/link"
import { getAuthUser } from "@/lib/auth/server"
import { Button } from "@/components/ui/button"

const nav = [
  { href: "/events", label: "Events" },
  { href: "/clubs", label: "Clubs" },
]

/** Public header: shows sign-in actions to visitors and a dashboard link to members. */
export async function SiteHeader() {
  const user = await getAuthUser()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Link
          href="/"
          className="shrink-0 rounded-md font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden className="text-primary">
            ›_
          </span>{" "}
          clunite
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span aria-hidden className="text-primary">
            ›_
          </span>{" "}
          clunite · clubs and events, together
        </p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/events" className="hover:text-foreground">
            Events
          </Link>
          <Link href="/clubs" className="hover:text-foreground">
            Clubs
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  )
}
