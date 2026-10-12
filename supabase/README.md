# Clunite database (Supabase)

Everything the app needs lives in three files:

| File | What it does | Required |
|---|---|---|
| `schema.sql` | Enums, tables, functions, triggers, grants, RLS policies, storage buckets. Idempotent. | Yes |
| `seed.sql` | 10 demo clubs (plans, faculty coordinator + HOD), 30 events incl. some happening today, and one attended event so the owner gets a certificate. Tagged `[DEMO]`, slugs `demo-*`. Skips itself if no user exists yet. | No |
| `tests/rls_test.sql` | Permission tests. Runs in one transaction and **rolls back** (leaves no data). | Recommended |

## Run order

1. `schema.sql` on the empty project.
2. Configure Auth (below) and sign up your first account in the app.
3. Promote yourself to `super_admin` (below).
4. Optional: `seed.sql` (edit `v_owner_email` at the top first).
5. Optional: `tests/rls_test.sql` to verify policies. "Success. No rows returned" means every check passed.

`schema.sql` is safe to run again after changes; it never drops data. **Re-run it after pulling schema changes** (e.g. the `clubs.hod_name` column used on certificates).

## How to apply

### A. SQL Editor (simplest)

Dashboard → **SQL Editor** → New query → paste `schema.sql` → **Run**. Repeat for the other files.

### B. Supabase CLI (`supabase db push`)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
mkdir -p supabase/migrations
cp supabase/schema.sql "supabase/migrations/$(date +%Y%m%d%H%M%S)_clunite_schema.sql"
npx supabase db push
```

For later schema changes, edit `schema.sql` (the source of truth) and push a new copy the same way.
Because it is idempotent, re-applying the whole file is safe.

## Upgrading an existing project

If your database was created from an older `schema.sql`, either re-run the current `schema.sql`, or paste
`supabase/patches/ALL_upgrade.sql` into the SQL Editor (one file, safe to re-run). Individual patches in
`supabase/patches/` add one feature each:

| Patch | Adds |
|---|---|
| `2026-10-12_interests_leaderboard.sql` | Student interests, leaderboard opt-out, student/club leaderboards |
| `2026-10-13_competitions.sql` | Rounds, submissions, judging, results, per-event leaderboard, `submissions` bucket |
| `2026-10-13_discovery.sql` | Event bookmarks |
| `2026-10-13_teams.sql` | Team invite codes, team members, team finder |
| `2026-10-13_forms_notifications.sql` | Custom registration questions, announcements, in-app notifications |
| `2026-10-13_opportunities.sql` | Internships & jobs, applications, private `resumes` bucket |
| `2026-10-13_portfolio.sql` | Public student portfolio profiles |

Then optionally re-run `seed.sql` to add the newer demo data (hackathon, team event, job postings).

## Cron jobs (optional)

Call these with `Authorization: Bearer $CRON_SECRET` (e.g. Vercel Cron):

- `GET /api/cron/expire-memberships`: daily
- `GET /api/cron/event-reminders`: hourly (emails registrants ~24h before an event)

## Auth settings

Dashboard → **Authentication**:

- **URL Configuration**
  - Site URL: your production URL (e.g. `https://clunite.example.com`). For local dev: `http://localhost:3001`.
  - Redirect URLs (add all that apply):
    - `http://localhost:3001/auth/callback`
    - `https://<your-domain>/auth/callback`
    - `https://<your-vercel-preview>-*.vercel.app/auth/callback` (optional, previews)
- **Providers → Email**: enabled. Keep **Confirm email** ON for production. Magic links use the same provider.
- **Providers → Google** (optional): enable it, paste the Google OAuth client id/secret, then set
  `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` in the app env so the button appears.
  In Google Cloud, the authorised redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
- **Emails → SMTP** (recommended for production): Supabase's built-in mailer is rate-limited.
- **Email templates**: the defaults work. Links come back to `/auth/callback`, which completes sign-in,
  password recovery and email change.

## API keys for the app

Dashboard → **Project Settings → API Keys**:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the **publishable** key (`sb_publishable_...`). Safe in the browser.
- `SUPABASE_SECRET_KEY` = a **secret** key (`sb_secret_...`) or the legacy `service_role` key. **Server only**:
  it bypasses RLS. The app uses it only in route handlers, after checking the caller (payments, QR credentials,
  PIN emails, uploads, webhooks).

## Promote the first super_admin

Sign up in the app first, then in the SQL Editor:

```sql
update public.users set global_role = 'super_admin' where email = 'you@example.com';
```

`global_role` can't be changed from the browser (column-level grants), so this must be done in SQL or by the
server.

## Optional: expire memberships automatically

Timed memberships are marked `expired` by `public.expire_memberships()`. Either enable **pg_cron**
(Database → Extensions) and schedule it:

```sql
select cron.schedule('expire-memberships', '15 * * * *', $$select public.expire_memberships()$$);
```

or call `GET /api/cron/expire-memberships` with `Authorization: Bearer $CRON_SECRET` (e.g. from Vercel Cron).
The app also treats an `active` membership whose `expires_at` has passed as expired when it displays it.

## Regenerate TypeScript types

`types/database.ts` mirrors `schema.sql`. After changing the schema:

```bash
npx supabase gen types typescript --project-id <your-project-ref> --schema public > types/database.ts
```

then re-append the small helper exports at the bottom of the old file (`Tables`, `Enums`, role lists).

## Verification checklist

After running `schema.sql`:

- [ ] Table Editor shows 12 tables in `public`, each with an **RLS enabled** badge:
      users, clubs, pending_clubs, membership_plans, club_memberships, events, event_registrations,
      event_expenses, payments, id_credentials, attendance, club_access_otps.
- [ ] `select count(*) from pg_policies where schemaname = 'public';` returns about 50.
- [ ] Storage shows public buckets `avatars`, `club-logos`, `club-banners`, `event-banners`.
- [ ] Sign up in the app → a row appears in `public.users` (trigger `on_auth_user_created`).
- [ ] Run `schema.sql` a second time: it completes without errors.
- [ ] `tests/rls_test.sql` completes with no exception.
- [ ] Create a club in the app → it gets 4 plans (Free, Standard, Premium, Lifetime) and you are `owner`
      with a `CLB-XXXXXX` member code.

## Schema decisions worth knowing

- `events.is_published` is generated from `events.status` (`draft | published | cancelled | completed`).
  Write `status`; read either.
- `club_memberships.is_owner` is generated from `role = 'owner'`.
- `events.current_participants`, `clubs.members_count` and `clubs.events_hosted_count` are maintained by triggers.
- Registration happens only through `register_for_event()`; payment status changes only through
  `finalize_payment()`, which only the service role can execute.
- Attendance is the `attendance` table (one row per event and user). There is no `attended` registration status.
