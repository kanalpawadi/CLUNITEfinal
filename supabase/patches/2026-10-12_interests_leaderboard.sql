-- =============================================================================
-- Patch: interests + leaderboard (for projects created from an older schema.sql)
-- =============================================================================
-- Paste into Supabase -> SQL Editor -> Run. Safe to run more than once.
-- Equivalent to re-running supabase/schema.sql (which also includes all of this).
-- =============================================================================

alter table public.users add column if not exists interests text[] not null default '{}';
alter table public.users add column if not exists show_on_leaderboard boolean not null default true;
alter table public.clubs add column if not exists hod_name text;

-- Users may edit these profile fields on their own row (RLS still limits it to their row)
revoke update on public.users from authenticated;
grant update (full_name, phone, gender, avatar_url, college, branch, bio, interests, show_on_leaderboard) on public.users to authenticated;

-- Leaderboards ---------------------------------------------------------------------
-- RLS hides other users' rows, so ranking runs as SECURITY DEFINER and returns only what a
-- leaderboard needs: a short display name ("Asha K."), avatar, college and points.
-- Students who set show_on_leaderboard = false are hidden from everyone but themselves.
-- Points: 10 per event attended, 2 per active registration, 5 per active club membership.
create or replace function public.get_student_leaderboard(p_days integer default null, p_limit integer default 50)
returns table (
  rank bigint, display_name text, avatar_url text, college text,
  points integer, events_attended integer, registrations integer, clubs_joined integer, is_me boolean
)
language sql stable security definer set search_path = ''
as $$
  with since as (
    select case when p_days is null then '-infinity'::timestamptz else now() - make_interval(days => p_days) end as t
  ),
  stats as (
    select u.id, u.full_name, u.email, u.avatar_url, u.college, u.show_on_leaderboard,
      (select count(*) from public.attendance a, since where a.user_id = u.id and a.checked_in_at >= since.t)::int as attended,
      (select count(*) from public.event_registrations r, since
        where r.user_id = u.id and r.status = 'registered' and r.created_at >= since.t)::int as regs,
      (select count(*) from public.club_memberships m
        where m.user_id = u.id and m.status = 'active' and (m.expires_at is null or m.expires_at > now()))::int as clubs
    from public.users u
  ),
  scored as (
    select s.*, (s.attended * 10 + s.regs * 2 + s.clubs * 5) as pts
    from stats s
    where (s.show_on_leaderboard or s.id = auth.uid())
  ),
  ranked as (
    select dense_rank() over (order by pts desc) as rnk, sc.*
    from scored sc
    where sc.pts > 0 or sc.id = auth.uid()
  )
  select
    rnk,
    coalesce(
      nullif(trim(split_part(coalesce(full_name, ''), ' ', 1) ||
        case when position(' ' in trim(coalesce(full_name, ''))) > 0
             then ' ' || upper(left(split_part(trim(full_name), ' ', array_length(string_to_array(trim(full_name), ' '), 1)), 1)) || '.'
             else '' end), ''),
      'Student'
    ),
    avatar_url, college, pts, attended, regs, clubs, id = auth.uid()
  from ranked
  where auth.uid() is not null
    and (rnk <= least(greatest(coalesce(p_limit, 50), 1), 200) or id = auth.uid())
  order by rnk, full_name;
$$;

-- Club ranking (clubs are public): attendance and events in the period, plus active members.
create or replace function public.get_club_leaderboard(p_days integer default null, p_limit integer default 50)
returns table (
  rank bigint, club_id uuid, name text, slug text, logo_url text, category text,
  members integer, events integer, attendance integer, points integer
)
language sql stable security definer set search_path = ''
as $$
  with since as (
    select case when p_days is null then '-infinity'::timestamptz else now() - make_interval(days => p_days) end as t
  ),
  stats as (
    select c.id, c.name, c.slug, c.logo_url, c.category, c.members_count::int as members,
      (select count(*) from public.events e, since
        where e.club_id = c.id and e.status in ('published', 'completed') and e.starts_at >= since.t and e.starts_at <= now())::int as evs,
      (select count(*) from public.attendance a join public.events e on e.id = a.event_id, since
        where e.club_id = c.id and a.checked_in_at >= since.t)::int as att
    from public.clubs c
    where c.is_active
  )
  select dense_rank() over (order by (att + evs * 5 + members * 2) desc), id, name, slug, logo_url, category,
         members, evs, att, (att + evs * 5 + members * 2)
  from stats
  order by 1, name
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke execute on function public.get_student_leaderboard(integer, integer) from public, anon;
grant execute on function public.get_student_leaderboard(integer, integer) to authenticated;
grant execute on function public.get_club_leaderboard(integer, integer) to anon, authenticated;

-- Make the API see the new columns/functions immediately
select pg_notify('pgrst', 'reload schema');
