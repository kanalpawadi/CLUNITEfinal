-- Patch: student portfolio profiles. Paste into Supabase -> SQL Editor -> Run (safe to re-run).
-- Re-running supabase/schema.sql does the same.

-- >>> 10f. Student portfolio profiles --------------------------------------------------
alter table public.users add column if not exists username text;
alter table public.users add column if not exists headline text;
alter table public.users add column if not exists skills text[] not null default '{}';
alter table public.users add column if not exists degree text;
alter table public.users add column if not exists graduation_year integer;
alter table public.users add column if not exists github_url text;
alter table public.users add column if not exists linkedin_url text;
alter table public.users add column if not exists portfolio_url text;
alter table public.users add column if not exists profile_public boolean not null default false;

do $$ begin
  alter table public.users add constraint users_username_format check (username is null or username ~ '^[a-z0-9_]{3,30}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.users add constraint users_portfolio_fields check (
    (headline is null or char_length(headline) <= 120)
    and (degree is null or char_length(degree) <= 120)
    and cardinality(skills) <= 25
    and (graduation_year is null or graduation_year between 1990 and 2100)
    and (github_url is null or (github_url ~* '^https://' and char_length(github_url) <= 300))
    and (linkedin_url is null or (linkedin_url ~* '^https://' and char_length(linkedin_url) <= 300))
    and (portfolio_url is null or (portfolio_url ~* '^https://' and char_length(portfolio_url) <= 300))
  );
exception when duplicate_object then null; end $$;
create unique index if not exists uq_users_username on public.users (username) where username is not null;

grant update (username, headline, skills, degree, graduation_year, github_url, linkedin_url, portfolio_url, profile_public)
  on public.users to authenticated;

-- Public portfolio: only when the student opted in (or it's their own). No email/phone.
create or replace function public.get_public_profile(p_username text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'full_name', u.full_name, 'username', u.username, 'avatar_url', u.avatar_url, 'headline', u.headline,
    'bio', u.bio, 'college', u.college, 'branch', u.branch, 'degree', u.degree, 'graduation_year', u.graduation_year,
    'skills', u.skills, 'github_url', u.github_url, 'linkedin_url', u.linkedin_url, 'portfolio_url', u.portfolio_url,
    'is_me', u.id = auth.uid(), 'is_public', u.profile_public, 'member_since', u.created_at,
    'stats', jsonb_build_object(
      'events_attended', (select count(*) from public.attendance a where a.user_id = u.id),
      'competitions', (select count(distinct r.event_id) from public.event_registrations r
                        join public.event_rounds er on er.event_id = r.event_id
                       where r.status = 'registered' and (r.user_id = u.id
                             or exists (select 1 from public.team_members tm where tm.registration_id = r.id and tm.user_id = u.id))),
      'clubs', (select count(*) from public.club_memberships m where m.user_id = u.id and m.status = 'active')
    ),
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('title', res.title, 'event', e.title, 'club', c.name, 'date', e.starts_at)
                       order by e.starts_at desc)
        from public.event_results res
        join public.event_registrations r on r.id = res.registration_id
        join public.events e on e.id = res.event_id
        left join public.clubs c on c.id = e.club_id
       where res.published and (r.user_id = u.id
             or exists (select 1 from public.team_members tm where tm.registration_id = r.id and tm.user_id = u.id))
    ), '[]'::jsonb),
    'clubs', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug, 'role', m.role) order by c.name)
        from public.club_memberships m join public.clubs c on c.id = m.club_id
       where m.user_id = u.id and m.status = 'active' and c.is_active
    ), '[]'::jsonb)
  )
  from public.users u
  where u.username = lower(trim(p_username))
    and (u.profile_public or u.id = auth.uid());
$$;
grant execute on function public.get_public_profile(text) to anon, authenticated;
-- <<< 10f

select pg_notify('pgrst', 'reload schema');
