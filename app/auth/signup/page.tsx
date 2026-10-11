import { redirect } from "next/navigation"

/** Legacy URL: keep old links (and their query string) working. */
export default function LegacySignupPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") query.set(key === "redirect" ? "redirectTo" : key, value)
  }
  const qs = query.toString()
  redirect(qs ? `/signup?${qs}` : "/signup")
}
