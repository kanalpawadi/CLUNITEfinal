import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { Award, CalendarCheck2, ExternalLink, Github, Globe, Linkedin, Lock, Trophy, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/events"
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader"

type Props = { params: { username: string } }

const profileSchema = z.object({
  full_name: z.string().nullable(),
  username: z.string(),
  avatar_url: z.string().nullable(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  college: z.string().nullable(),
  branch: z.string().nullable(),
  degree: z.string().nullable(),
  graduation_year: z.number().nullable(),
  skills: z.array(z.string()),
  github_url: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  portfolio_url: z.string().nullable(),
  is_me: z.boolean(),
  is_public: z.boolean(),
  member_since: z.string(),
  stats: z.object({ events_attended: z.number(), competitions: z.number(), clubs: z.number() }),
  achievements: z.array(z.object({ title: z.string(), event: z.string(), club: z.string().nullable(), date: z.string() })),
  clubs: z.array(z.object({ name: z.string(), slug: z.string(), role: z.string() })),
})

async function load(username: string) {
  if (!/^[a-z0-9_]{3,30}$/i.test(username)) return null
  const { data } = await createClient().rpc("get_public_profile", { p_username: username })
  const parsed = profileSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load(params.username)
  return p
    ? { title: `${p.full_name ?? p.username} · Clunite`, description: p.headline ?? undefined, robots: p.is_public ? undefined : { index: false } }
    : { title: "Profile · Clunite" }
}

export default async function PublicProfilePage({ params }: Props) {
  const p = await load(params.username)
  if (!p) notFound()
  const links = [
    { href: p.github_url, label: "GitHub", Icon: Github },
    { href: p.linkedin_url, label: "LinkedIn", Icon: Linkedin },
    { href: p.portfolio_url, label: "Website", Icon: Globe },
  ].filter((l): l is { href: string; label: string; Icon: typeof Github } => !!l.href)

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        {p.is_me && !p.is_public && (
          <p className="mb-6 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            <Lock className="h-4 w-4" aria-hidden /> Only you can see this page.{" "}
            <Link href="/profile" className="underline underline-offset-4">Make it public</Link>
          </p>
        )}

        <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {p.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar_url} alt="" className="h-24 w-24 rounded-2xl border border-border object-cover" />
          ) : (
            <span aria-hidden className="flex h-24 w-24 items-center justify-center rounded-2xl bg-muted text-3xl font-semibold text-primary">
              {(p.full_name ?? p.username).charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground">{p.full_name ?? p.username}</h1>
            <p className="text-sm text-muted-foreground">@{p.username}</p>
            {p.headline && <p className="mt-1 text-foreground">{p.headline}</p>}
            <p className="mt-1 text-sm text-muted-foreground">
              {[p.degree, p.branch, p.college, p.graduation_year ? `Class of ${p.graduation_year}` : null].filter(Boolean).join(" · ")}
            </p>
            {links.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-3 text-sm">
                {links.map(({ href, label, Icon }) => (
                  <li key={label}>
                    <a href={href} target="_blank" rel="noreferrer noopener me" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                      <Icon className="h-4 w-4" aria-hidden /> {label} <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </header>

        <dl className="mt-8 grid grid-cols-3 gap-3">
          {[
            { label: "Events attended", value: p.stats.events_attended, Icon: CalendarCheck2 },
            { label: "Competitions", value: p.stats.competitions, Icon: Trophy },
            { label: "Clubs", value: p.stats.clubs, Icon: Users },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        {p.bio && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-foreground">About</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">{p.bio}</p>
          </section>
        )}

        {p.skills.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-foreground">Skills</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {p.skills.map((s) => (
                <li key={s} className="rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground">{s}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Award className="h-5 w-5 text-primary" aria-hidden /> Achievements
          </h2>
          {p.achievements.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {p.achievements.map((a, i) => (
                <li key={`${a.event}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
                  <span className="text-sm text-foreground">
                    <span className="font-semibold text-primary">{a.title}</span> · {a.event}
                    {a.club && <span className="text-muted-foreground"> by {a.club}</span>}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{formatDate(a.date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No competition results yet.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Achievements come from published competition results on Clunite and can&apos;t be self-reported.</p>
        </section>

        {p.clubs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-foreground">Clubs</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {p.clubs.map((c) => (
                <li key={c.slug}>
                  <Link href={`/clubs/${c.slug}`} className="inline-block rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:border-primary">
                    {c.name} <span className="text-xs capitalize text-muted-foreground">· {c.role}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
