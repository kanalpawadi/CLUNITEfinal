-- Patch: discovery bookmarks. Paste into Supabase -> SQL Editor -> Run (safe to re-run).
-- Re-running supabase/schema.sql does the same.

-- >>> 10b. Discovery: bookmarks ------------------------------------------------------
create table if not exists public.event_bookmarks (
  user_id    uuid not null references public.users (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index if not exists idx_event_bookmarks_event on public.event_bookmarks (event_id);
create index if not exists idx_events_deadline on public.events (registration_deadline);
create index if not exists idx_events_views on public.events (views desc);

alter table public.event_bookmarks enable row level security;
drop policy if exists bookmarks_own on public.event_bookmarks;
create policy bookmarks_own on public.event_bookmarks
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.event_bookmarks from anon;
-- <<< 10b

select pg_notify('pgrst', 'reload schema');
