-- =============================================================================
-- ALL-IN-ONE upgrade for projects created from an older schema.sql
-- =============================================================================
-- Paste this whole file into Supabase -> SQL Editor -> Run. Safe to run more than once.
-- It is the individual patches below, in order. (Re-running supabase/schema.sql is equivalent.)
-- =============================================================================

-- ######## 2026-10-12_interests_leaderboard ########
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


-- ######## 2026-10-13_competitions ########
-- =============================================================================
-- Patch: competitions (rounds, submissions, judging, results, leaderboard)
-- =============================================================================
-- For projects created before this feature. Paste into Supabase -> SQL Editor -> Run.
-- Safe to run more than once. Re-running supabase/schema.sql does the same.
-- =============================================================================

-- >>> 10a. Competitions: rounds, submissions, judging, results -----------------------

-- Is the caller the registrant (team lead) or a member of this registration's team?
create or replace function public.is_registration_member(reg uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.event_registrations r where r.id = reg and r.user_id = auth.uid()) then
    return true;
  end if;
  if to_regclass('public.team_members') is not null then
    return exists (select 1 from public.team_members tm where tm.registration_id = reg and tm.user_id = auth.uid());
  end if;
  return false;
end;
$$;

create table if not exists public.event_rounds (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events (id) on delete cascade,
  round_no          integer not null check (round_no between 1 and 20),
  title             text not null check (char_length(title) between 2 and 120),
  description       text check (char_length(description) <= 5000),
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  submission_type   text not null default 'link' check (submission_type in ('none', 'link', 'file', 'text')),
  max_score         numeric(8,2) not null default 100 check (max_score > 0),
  results_published boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint event_rounds_event_round_key unique (event_id, round_no),
  constraint event_rounds_time_order check (ends_at > starts_at)
);
create index if not exists idx_event_rounds_event on public.event_rounds (event_id);

create table if not exists public.round_submissions (
  id              uuid primary key default gen_random_uuid(),
  round_id        uuid not null references public.event_rounds (id) on delete cascade,
  registration_id uuid not null references public.event_registrations (id) on delete cascade,
  submitted_by    uuid references public.users (id) on delete set null,
  link_url        text check (link_url is null or (link_url ~* '^https?://' and char_length(link_url) <= 2048)),
  text_content    text check (text_content is null or char_length(text_content) <= 10000),
  file_path       text check (file_path is null or char_length(file_path) <= 512),
  submitted_at    timestamptz,
  status          text not null default 'submitted' check (status in ('submitted', 'shortlisted', 'eliminated')),
  score           numeric(8,2) check (score is null or score >= 0),
  feedback        text check (feedback is null or char_length(feedback) <= 5000),
  judged_by       uuid references public.users (id) on delete set null,
  judged_at       timestamptz,
  constraint round_submissions_round_registration_key unique (round_id, registration_id)
);
create index if not exists idx_round_submissions_registration on public.round_submissions (registration_id);

create table if not exists public.event_results (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events (id) on delete cascade,
  registration_id uuid not null references public.event_registrations (id) on delete cascade,
  position        integer not null check (position between 1 and 50),
  title           text not null check (char_length(title) between 2 and 60),
  published       boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint event_results_event_registration_key unique (event_id, registration_id)
);
create index if not exists idx_event_results_event on public.event_results (event_id);

create or replace trigger trg_event_rounds_updated_at before update on public.event_rounds
  for each row execute function public.set_updated_at();

-- A participant (team lead or member) submits for an open round they are eligible for
create or replace function public.submit_round_entry(
  p_round_id uuid,
  p_link_url text default null,
  p_text text default null,
  p_file_path text default null
)
returns public.round_submissions
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_round public.event_rounds;
  v_event public.events;
  v_reg public.event_registrations;
  v_prev public.round_submissions;
  v_sub public.round_submissions;
begin
  if v_uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  select * into v_round from public.event_rounds where id = p_round_id;
  if not found then raise exception 'Round not found' using errcode = 'P0002'; end if;
  select * into v_event from public.events where id = v_round.event_id;
  if v_event.status <> 'published' then raise exception 'This competition is not open' using errcode = 'P0001'; end if;
  if now() < v_round.starts_at then raise exception 'This round has not started yet' using errcode = 'P0001'; end if;
  if now() > v_round.ends_at then raise exception 'This round is closed' using errcode = 'P0001'; end if;
  if v_round.submission_type = 'none' then raise exception 'This round has no online submission' using errcode = 'P0001'; end if;

  select r.* into v_reg from public.event_registrations r
   where r.event_id = v_event.id and r.status = 'registered' and public.is_registration_member(r.id)
   limit 1;
  if not found then raise exception 'Register for this competition first' using errcode = '42501'; end if;
  if v_event.fee > 0 and v_reg.payment_status is distinct from 'paid' then
    raise exception 'Complete your registration payment first' using errcode = 'P0001';
  end if;

  if v_round.round_no > 1 then
    select s.* into v_prev from public.round_submissions s
      join public.event_rounds pr on pr.id = s.round_id
     where pr.event_id = v_event.id and pr.round_no < v_round.round_no and s.registration_id = v_reg.id
     order by pr.round_no desc limit 1;
    if not found or v_prev.status <> 'shortlisted' then
      raise exception 'Only teams shortlisted in the previous round can submit' using errcode = '42501';
    end if;
  end if;

  if v_round.submission_type = 'link' and (p_link_url is null or p_link_url !~* '^https?://') then
    raise exception 'Add a valid link (https://...)' using errcode = '22023';
  elsif v_round.submission_type = 'text' and coalesce(trim(p_text), '') = '' then
    raise exception 'Write your answer' using errcode = '22023';
  elsif v_round.submission_type = 'file'
        and (p_file_path is null or p_file_path not like (v_event.id::text || '/' || v_reg.id::text || '/%')) then
    raise exception 'Upload your file first' using errcode = '22023';
  end if;

  select * into v_sub from public.round_submissions where round_id = v_round.id and registration_id = v_reg.id;
  if found and (v_sub.score is not null or v_sub.status <> 'submitted') then
    raise exception 'This entry has already been judged' using errcode = 'P0001';
  end if;

  insert into public.round_submissions as s (round_id, registration_id, submitted_by, link_url, text_content, file_path, submitted_at)
  values (v_round.id, v_reg.id, v_uid,
          case when v_round.submission_type = 'link' then p_link_url end,
          case when v_round.submission_type = 'text' then trim(p_text) end,
          case when v_round.submission_type = 'file' then p_file_path end,
          now())
  on conflict (round_id, registration_id) do update
    set submitted_by = excluded.submitted_by, link_url = excluded.link_url, text_content = excluded.text_content,
        file_path = excluded.file_path, submitted_at = now()
  returning * into v_sub;
  return v_sub;
end;
$$;

-- Staff score / shortlist / eliminate an entry (creates the row for offline rounds)
create or replace function public.judge_round_entry(
  p_round_id uuid,
  p_registration_id uuid,
  p_score numeric default null,
  p_status text default null,
  p_feedback text default null
)
returns public.round_submissions
language plpgsql security definer set search_path = ''
as $$
declare
  v_round public.event_rounds;
  v_sub public.round_submissions;
begin
  select * into v_round from public.event_rounds where id = p_round_id;
  if not found then raise exception 'Round not found' using errcode = 'P0002'; end if;
  if not (public.is_event_staff(v_round.event_id, array['owner','admin','organizer']::public.club_role[]) or public.is_super_admin()) then
    raise exception 'Only club organizers can judge' using errcode = '42501';
  end if;
  if not exists (select 1 from public.event_registrations r where r.id = p_registration_id and r.event_id = v_round.event_id) then
    raise exception 'Registration is not part of this event' using errcode = '22023';
  end if;
  if p_score is not null and (p_score < 0 or p_score > v_round.max_score) then
    raise exception 'Score must be between 0 and %', v_round.max_score using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('submitted', 'shortlisted', 'eliminated') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  insert into public.round_submissions as s (round_id, registration_id, score, status, feedback, judged_by, judged_at)
  values (p_round_id, p_registration_id, p_score, coalesce(p_status, 'submitted'), nullif(trim(p_feedback), ''), auth.uid(), now())
  on conflict (round_id, registration_id) do update
    set score = excluded.score,
        status = coalesce(p_status, s.status),
        feedback = excluded.feedback,
        judged_by = auth.uid(),
        judged_at = now()
  returning * into v_sub;
  return v_sub;
end;
$$;

-- Public competition leaderboard: only rounds whose results were published count.
create or replace function public.get_event_leaderboard(p_event_id uuid)
returns table (rank bigint, name text, total_score numeric, rounds_cleared integer, result_title text, is_mine boolean)
language sql stable security definer set search_path = ''
as $$
  with ev as (select id from public.events where id = p_event_id and status in ('published', 'completed')),
  scores as (
    select r.id as reg_id, r.team_name, u.full_name,
           coalesce(sum(s.score) filter (where er.results_published), 0) as total,
           count(*) filter (where er.results_published and s.status = 'shortlisted')::int as cleared
      from public.event_registrations r
      join ev on ev.id = r.event_id
      left join public.users u on u.id = r.user_id
      left join public.round_submissions s on s.registration_id = r.id
      left join public.event_rounds er on er.id = s.round_id
     where r.status = 'registered'
     group by r.id, r.team_name, u.full_name
  )
  select dense_rank() over (order by sc.total desc),
         coalesce(nullif(sc.team_name, ''),
                  split_part(coalesce(sc.full_name, 'Participant'), ' ', 1) ||
                  case when position(' ' in trim(coalesce(sc.full_name, ''))) > 0
                       then ' ' || upper(left(split_part(trim(sc.full_name), ' ', array_length(string_to_array(trim(sc.full_name), ' '), 1)), 1)) || '.'
                       else '' end),
         sc.total, sc.cleared,
         (select res.title from public.event_results res where res.registration_id = sc.reg_id and res.published),
         public.is_registration_member(sc.reg_id)
    from scores sc
   where sc.total > 0 or exists (select 1 from public.event_results res where res.registration_id = sc.reg_id and res.published)
   order by 1, 2;
$$;

alter table public.event_rounds enable row level security;
alter table public.round_submissions enable row level security;
alter table public.event_results enable row level security;

drop policy if exists rounds_select_public on public.event_rounds;
create policy rounds_select_public on public.event_rounds
  for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_rounds.event_id and e.status in ('published', 'completed')));
drop policy if exists rounds_select_staff on public.event_rounds;
create policy rounds_select_staff on public.event_rounds
  for select to authenticated using (public.is_event_staff(event_id, array['owner','admin','organizer','treasurer']::public.club_role[]));
drop policy if exists rounds_write_staff on public.event_rounds;
create policy rounds_write_staff on public.event_rounds
  for all to authenticated
  using (public.is_event_staff(event_id, array['owner','admin','organizer']::public.club_role[]))
  with check (public.is_event_staff(event_id, array['owner','admin','organizer']::public.club_role[]));

drop policy if exists submissions_select_own on public.round_submissions;
create policy submissions_select_own on public.round_submissions
  for select to authenticated using (public.is_registration_member(registration_id));
drop policy if exists submissions_select_staff on public.round_submissions;
create policy submissions_select_staff on public.round_submissions
  for select to authenticated
  using (exists (select 1 from public.event_rounds r where r.id = round_submissions.round_id
                 and public.is_event_staff(r.event_id, array['owner','admin','organizer']::public.club_role[])));

drop policy if exists results_select_public on public.event_results;
create policy results_select_public on public.event_results
  for select to anon, authenticated
  using (published and exists (select 1 from public.events e where e.id = event_results.event_id and e.status in ('published', 'completed')));
drop policy if exists results_select_staff on public.event_results;
create policy results_select_staff on public.event_results
  for select to authenticated using (public.is_event_staff(event_id, array['owner','admin','organizer']::public.club_role[]));
drop policy if exists results_write_staff on public.event_results;
create policy results_write_staff on public.event_results
  for all to authenticated
  using (public.is_event_staff(event_id, array['owner','admin','organizer']::public.club_role[]))
  with check (public.is_event_staff(event_id, array['owner','admin','organizer']::public.club_role[]));

-- Submissions change only through submit_round_entry() / judge_round_entry()
revoke insert, update, delete on public.round_submissions from authenticated;
revoke all on public.round_submissions from anon;
revoke all on public.event_rounds, public.event_results from anon;
grant select on public.event_rounds, public.event_results to anon;
revoke execute on function public.submit_round_entry(uuid, text, text, text) from public, anon;
revoke execute on function public.judge_round_entry(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.submit_round_entry(uuid, text, text, text) to authenticated;
grant execute on function public.judge_round_entry(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.get_event_leaderboard(uuid) to anon, authenticated;

-- Private bucket for file submissions: <event id>/<registration id>/<file>; written/read by the server
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 20971520,
        array['application/pdf','application/zip','application/x-zip-compressed','image/png','image/jpeg',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- <<< 10a



-- ######## 2026-10-13_discovery ########
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



-- ######## 2026-10-13_teams ########
-- Patch: teams (invite codes, members, team finder). Paste into Supabase -> SQL Editor -> Run.
-- Safe to re-run. Re-running supabase/schema.sql does the same.

-- >>> 10c. Teams: invite codes, members, team finder ---------------------------------

alter table public.event_registrations add column if not exists invite_code text;
create unique index if not exists uq_event_registrations_invite_code on public.event_registrations (invite_code) where invite_code is not null;

create table if not exists public.team_members (
  registration_id uuid not null references public.event_registrations (id) on delete cascade,
  user_id         uuid not null references public.users (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (registration_id, user_id)
);
create index if not exists idx_team_members_user on public.team_members (user_id);

-- Max people per team for an event's team_size (lead included)
create or replace function public.team_capacity(p_team_size text)
returns integer
language sql immutable set search_path = ''
as $$
  select case p_team_size when '2_people' then 2 when 'group_4+' then 8 when 'group_4' then 8 else 1 end;
$$;

create or replace function public.new_invite_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := 'T-';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.event_registrations where invite_code = code);
  end loop;
  return code;
end;
$$;

-- Team registrations get an invite code automatically
create or replace function public.set_registration_invite_code()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.invite_code is null
     and public.team_capacity((select e.team_size from public.events e where e.id = new.event_id)) > 1 then
    new.invite_code := public.new_invite_code();
  end if;
  return new;
end;
$$;

create or replace trigger trg_event_registrations_invite_code
  before insert on public.event_registrations
  for each row execute function public.set_registration_invite_code();

-- Backfill codes for team registrations created before this feature
update public.event_registrations r
   set invite_code = public.new_invite_code()
  from public.events e
 where e.id = r.event_id and r.invite_code is null and public.team_capacity(e.team_size) > 1;

-- What a teammate sees before joining (no personal data beyond the lead's first name)
create or replace function public.preview_team_invite(p_code text)
returns table (event_id uuid, event_title text, team_name text, lead_first_name text, members integer, capacity integer)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.title, r.team_name, split_part(coalesce(u.full_name, 'A student'), ' ', 1),
         1 + (select count(*) from public.team_members tm where tm.registration_id = r.id)::int,
         public.team_capacity(e.team_size)
    from public.event_registrations r
    join public.events e on e.id = r.event_id
    left join public.users u on u.id = r.user_id
   where r.invite_code = upper(trim(p_code)) and r.status = 'registered' and e.status = 'published'
     and auth.uid() is not null;
$$;

create or replace function public.join_team(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_reg public.event_registrations;
  v_event public.events;
  v_members int;
begin
  if v_uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  select * into v_reg from public.event_registrations where invite_code = upper(trim(p_code)) and status = 'registered' for update;
  if not found then raise exception 'Invalid or expired invite code' using errcode = 'P0002'; end if;
  select * into v_event from public.events where id = v_reg.event_id;
  if v_event.status <> 'published' then raise exception 'This event is not open' using errcode = 'P0001'; end if;
  if now() > coalesce(v_event.ends_at, v_event.starts_at) then raise exception 'This event has ended' using errcode = 'P0001'; end if;
  if v_reg.user_id = v_uid then raise exception 'You already lead this team' using errcode = 'P0001'; end if;
  if exists (select 1 from public.team_members where registration_id = v_reg.id and user_id = v_uid) then
    return v_reg.id; -- already a member: idempotent
  end if;
  if exists (select 1 from public.event_registrations r where r.event_id = v_event.id and r.user_id = v_uid and r.status <> 'cancelled') then
    raise exception 'You are already registered for this event. Cancel that registration to join a team.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.team_members tm join public.event_registrations r on r.id = tm.registration_id
              where r.event_id = v_event.id and tm.user_id = v_uid) then
    raise exception 'You are already in another team for this event' using errcode = 'P0001';
  end if;

  v_members := 1 + (select count(*) from public.team_members where registration_id = v_reg.id);
  if v_members >= public.team_capacity(v_event.team_size) then
    raise exception 'This team is full' using errcode = 'P0001';
  end if;
  if v_event.capacity is not null and v_members + 1 > v_reg.participant_count
     and v_event.current_participants + 1 > v_event.capacity then
    raise exception 'The event is full' using errcode = 'P0001';
  end if;

  insert into public.team_members (registration_id, user_id) values (v_reg.id, v_uid);
  update public.event_registrations set participant_count = greatest(participant_count, v_members + 1) where id = v_reg.id;
  return v_reg.id;
end;
$$;

create or replace function public.rotate_invite_code(p_registration_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_code text;
begin
  if not exists (select 1 from public.event_registrations where id = p_registration_id and user_id = auth.uid() and invite_code is not null) then
    raise exception 'Only the team lead can change the invite code' using errcode = '42501';
  end if;
  v_code := public.new_invite_code();
  update public.event_registrations set invite_code = v_code where id = p_registration_id;
  return v_code;
end;
$$;

-- Team finder board
create table if not exists public.team_finder_posts (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  kind         text not null check (kind in ('need_team', 'need_members')),
  skills       text[] not null default '{}' check (cardinality(skills) <= 12),
  message      text not null check (char_length(message) between 10 and 600),
  show_contact boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint team_finder_posts_event_user_key unique (event_id, user_id)
);
create index if not exists idx_team_finder_posts_event on public.team_finder_posts (event_id, created_at desc);

-- Posts with a safe author label; email only when the author opted in.
create or replace function public.get_team_finder_posts(p_event_id uuid)
returns table (id uuid, kind text, skills text[], message text, created_at timestamptz,
               author text, avatar_url text, college text, contact_email text, is_mine boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.kind, p.skills, p.message, p.created_at,
         split_part(coalesce(u.full_name, 'Student'), ' ', 1) ||
           case when position(' ' in trim(coalesce(u.full_name, ''))) > 0
                then ' ' || upper(left(split_part(trim(u.full_name), ' ', array_length(string_to_array(trim(u.full_name), ' '), 1)), 1)) || '.'
                else '' end,
         u.avatar_url, u.college,
         case when p.show_contact then u.email end,
         p.user_id = auth.uid()
    from public.team_finder_posts p
    join public.users u on u.id = p.user_id
    join public.events e on e.id = p.event_id
   where p.event_id = p_event_id and e.status = 'published' and auth.uid() is not null
   order by p.created_at desc
   limit 200;
$$;

-- Team roster for members of that team only: first name + initial, lead flag
create or replace function public.get_team_roster(p_registration_id uuid)
returns table (name text, is_lead boolean, is_me boolean, joined_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with people as (
    select r.user_id, true as is_lead, r.created_at as joined_at from public.event_registrations r where r.id = p_registration_id
    union all
    select tm.user_id, false, tm.joined_at from public.team_members tm where tm.registration_id = p_registration_id
  )
  select split_part(coalesce(u.full_name, 'Member'), ' ', 1) ||
           case when position(' ' in trim(coalesce(u.full_name, ''))) > 0
                then ' ' || upper(left(split_part(trim(u.full_name), ' ', array_length(string_to_array(trim(u.full_name), ' '), 1)), 1)) || '.'
                else '' end,
         p.is_lead, p.user_id = auth.uid(), p.joined_at
    from people p join public.users u on u.id = p.user_id
   where public.is_registration_member(p_registration_id)
   order by p.is_lead desc, p.joined_at;
$$;

alter table public.team_members enable row level security;
alter table public.team_finder_posts enable row level security;

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select to authenticated
  using (public.is_registration_member(registration_id)
         or exists (select 1 from public.event_registrations r where r.id = team_members.registration_id
                    and public.is_event_staff(r.event_id, array['owner','admin','organizer','treasurer']::public.club_role[])));
drop policy if exists team_members_delete on public.team_members;
create policy team_members_delete on public.team_members
  for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.event_registrations r where r.id = team_members.registration_id and r.user_id = auth.uid()));

-- Team members can see their team's registration row
drop policy if exists registrations_select_member on public.event_registrations;
create policy registrations_select_member on public.event_registrations
  for select to authenticated using (public.is_registration_member(id));

drop policy if exists finder_own_write on public.team_finder_posts;
create policy finder_own_write on public.team_finder_posts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke insert, update on public.team_members from authenticated;
revoke all on public.team_members, public.team_finder_posts from anon;
revoke execute on function public.join_team(text) from public, anon;
revoke execute on function public.rotate_invite_code(uuid) from public, anon;
revoke execute on function public.preview_team_invite(text) from public, anon;
revoke execute on function public.get_team_finder_posts(uuid) from public, anon;
grant execute on function public.join_team(text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;
grant execute on function public.preview_team_invite(text) to authenticated;
grant execute on function public.get_team_finder_posts(uuid) to authenticated;
revoke execute on function public.get_team_roster(uuid) from public, anon;
grant execute on function public.get_team_roster(uuid) to authenticated;
-- <<< 10c

-- register_for_event now refuses people who already joined a team for the event
create or replace function public.register_for_event(
  p_event_id uuid,
  p_team_name text default null,
  p_registration_data jsonb default null,
  p_participant_count integer default 1
)
returns public.event_registrations
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_reg public.event_registrations;
begin
  if v_uid is null then
    raise exception 'You must be signed in to register' using errcode = '28000';
  end if;
  if p_participant_count is null or p_participant_count < 1 or p_participant_count > 50 then
    raise exception 'Invalid participant count' using errcode = '22023';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if v_event.registration_deadline is not null and now() > v_event.registration_deadline then
    raise exception 'Registration deadline has passed' using errcode = 'P0001';
  end if;
  if now() > coalesce(v_event.ends_at, v_event.starts_at) then
    raise exception 'This event has already ended' using errcode = 'P0001';
  end if;

  select * into v_reg from public.event_registrations where event_id = p_event_id and user_id = v_uid;
  if found and v_reg.status <> 'cancelled' then
    return v_reg; -- idempotent: already registered
  end if;
  if to_regclass('public.team_members') is not null and exists (
       select 1 from public.team_members tm join public.event_registrations r on r.id = tm.registration_id
        where r.event_id = p_event_id and tm.user_id = v_uid) then
    raise exception 'You already joined a team for this event' using errcode = 'P0001';
  end if;

  if v_event.capacity is not null and v_event.current_participants + p_participant_count > v_event.capacity then
    raise exception 'Event is full' using errcode = 'P0001';
  end if;

  insert into public.event_registrations (event_id, user_id, status, payment_status, team_name, registration_data, participant_count)
  values (p_event_id, v_uid, 'registered',
          case when v_event.fee > 0 then 'created'::public.payment_status else null end,
          p_team_name, p_registration_data, p_participant_count)
  on conflict (event_id, user_id) do update
    set status = 'registered',
        payment_status = case when v_event.fee > 0 then
                           case when public.event_registrations.payment_status = 'paid' then 'paid'::public.payment_status
                                else 'created'::public.payment_status end
                         else null end,
        team_name = excluded.team_name,
        registration_data = excluded.registration_data,
        participant_count = excluded.participant_count
  returning * into v_reg;

  return v_reg;
end;
$$;



-- ######## 2026-10-13_forms_notifications ########
-- Patch: registration questions, announcements and notifications.
-- Paste into Supabase -> SQL Editor -> Run (safe to re-run). Re-running supabase/schema.sql does the same.

-- >>> 10d. Registration questions, announcements, notifications -----------------------

-- [{ "id": "q1", "label": "GitHub profile", "type": "text|textarea|select|checkbox|url", "required": true, "options": [...] }]
alter table public.events add column if not exists registration_questions jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.events add constraint events_registration_questions_array
    check (jsonb_typeof(registration_questions) = 'array' and jsonb_array_length(registration_questions) <= 20);
exception when duplicate_object then null; end $$;
grant update (registration_questions) on public.events to authenticated;

alter table public.event_registrations add column if not exists confirmation_sent_at timestamptz;
alter table public.event_registrations add column if not exists reminder_sent_at timestamptz;

-- Required custom questions must be answered (called by register_for_event)
create or replace function public.validate_registration_answers(p_questions jsonb, p_data jsonb)
returns void
language plpgsql immutable set search_path = ''
as $$
declare q jsonb; v text;
begin
  for q in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    if coalesce((q->>'required')::boolean, false) then
      v := p_data->'answers'->>(q->>'id');
      if v is null or trim(v) = '' or (q->>'type' = 'checkbox' and v <> 'true') then
        raise exception 'Please answer: %', q->>'label' using errcode = '22023';
      end if;
    end if;
  end loop;
end;
$$;

create table if not exists public.event_announcements (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  author_id     uuid references public.users (id) on delete set null,
  title         text not null check (char_length(title) between 3 and 120),
  body          text not null check (char_length(body) between 1 and 5000),
  emailed_count integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_event_announcements_event on public.event_announcements (event_id, created_at desc);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  title      text not null check (char_length(title) <= 200),
  body       text check (char_length(body) <= 1000),
  link       text check (link is null or link ~ '^/'),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

-- Everyone on a registration (lead + team members)
create or replace function public.registration_people(p_registration_id uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select user_id from public.event_registrations where id = p_registration_id
  union
  select user_id from public.team_members where registration_id = p_registration_id;
$$;

create or replace function public.notify_users(p_users uuid[], p_title text, p_body text, p_link text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, title, body, link)
  select distinct u, left(p_title, 200), left(p_body, 1000), p_link from unnest(p_users) u where u is not null;
$$;

create or replace function public.trg_notify_registration()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_title text;
begin
  if new.status = 'registered' and (tg_op = 'INSERT' or old.status <> 'registered') then
    select title into v_title from public.events where id = new.event_id;
    perform public.notify_users(array[new.user_id], 'Registered: ' || v_title,
      'You are registered. Show your QR ID card at the entrance.', '/events/' || new.event_id || '/register');
  end if;
  return null;
end;
$$;
create or replace trigger trg_event_registrations_notify
  after insert or update of status on public.event_registrations
  for each row execute function public.trg_notify_registration();

create or replace function public.trg_notify_announcement()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify_users(
    array(select p from public.event_registrations r, public.registration_people(r.id) p
           where r.event_id = new.event_id and r.status = 'registered'),
    new.title, left(new.body, 300), '/events/' || new.event_id || '/register');
  return null;
end;
$$;
create or replace trigger trg_event_announcements_notify
  after insert on public.event_announcements
  for each row execute function public.trg_notify_announcement();

create or replace function public.trg_notify_round_results()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.results_published and not old.results_published then
    perform public.notify_users(
      array(select p from public.round_submissions s, public.registration_people(s.registration_id) p where s.round_id = new.id),
      'Results are out: ' || new.title, 'Check your score and whether you made the next round.',
      '/events/' || new.event_id || '/register');
  end if;
  return null;
end;
$$;
create or replace trigger trg_event_rounds_notify
  after update of results_published on public.event_rounds
  for each row execute function public.trg_notify_round_results();

create or replace function public.trg_notify_result()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    perform public.notify_users(array(select public.registration_people(new.registration_id)),
      'Congratulations! ' || new.title, 'Your certificate of achievement is ready.', '/dashboard/student/certificates');
  end if;
  return null;
end;
$$;
create or replace trigger trg_event_results_notify
  after insert or update of published on public.event_results
  for each row execute function public.trg_notify_result();

create or replace function public.trg_notify_membership()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_club text; v_slug text;
begin
  if new.status = 'active' and old.status = 'pending' then
    select name, slug into v_club, v_slug from public.clubs where id = new.club_id;
    perform public.notify_users(array[new.user_id], 'Welcome to ' || v_club, 'Your membership was approved.', '/clubs/' || v_slug);
  end if;
  return null;
end;
$$;
create or replace trigger trg_club_memberships_notify
  after update of status on public.club_memberships
  for each row execute function public.trg_notify_membership();

alter table public.event_announcements enable row level security;
alter table public.notifications enable row level security;

drop policy if exists announcements_select on public.event_announcements;
create policy announcements_select on public.event_announcements
  for select to authenticated
  using (public.is_event_staff(event_id, array['owner','admin','organizer','treasurer']::public.club_role[])
         or exists (select 1 from public.event_registrations r where r.event_id = event_announcements.event_id
                    and r.status = 'registered' and public.is_registration_member(r.id)));
drop policy if exists announcements_insert_staff on public.event_announcements;
create policy announcements_insert_staff on public.event_announcements
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_event_staff(event_id, array['owner','admin','organizer']::public.club_role[]));
drop policy if exists announcements_delete_staff on public.event_announcements;
create policy announcements_delete_staff on public.event_announcements
  for delete to authenticated using (public.is_event_staff(event_id, array['owner','admin','organizer']::public.club_role[]));

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.event_announcements, public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke update on public.event_announcements from authenticated;
revoke execute on function public.notify_users(uuid[], text, text, text) from public, anon, authenticated;
revoke execute on function public.registration_people(uuid) from public, anon, authenticated;
-- <<< 10d

-- register_for_event now validates required custom answers
create or replace function public.register_for_event(
  p_event_id uuid,
  p_team_name text default null,
  p_registration_data jsonb default null,
  p_participant_count integer default 1
)
returns public.event_registrations
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_reg public.event_registrations;
begin
  if v_uid is null then
    raise exception 'You must be signed in to register' using errcode = '28000';
  end if;
  if p_participant_count is null or p_participant_count < 1 or p_participant_count > 50 then
    raise exception 'Invalid participant count' using errcode = '22023';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if v_event.registration_deadline is not null and now() > v_event.registration_deadline then
    raise exception 'Registration deadline has passed' using errcode = 'P0001';
  end if;
  if now() > coalesce(v_event.ends_at, v_event.starts_at) then
    raise exception 'This event has already ended' using errcode = 'P0001';
  end if;

  select * into v_reg from public.event_registrations where event_id = p_event_id and user_id = v_uid;
  if found and v_reg.status <> 'cancelled' then
    return v_reg; -- idempotent: already registered
  end if;
  if to_regclass('public.team_members') is not null and exists (
       select 1 from public.team_members tm join public.event_registrations r on r.id = tm.registration_id
        where r.event_id = p_event_id and tm.user_id = v_uid) then
    raise exception 'You already joined a team for this event' using errcode = 'P0001';
  end if;

  if v_event.capacity is not null and v_event.current_participants + p_participant_count > v_event.capacity then
    raise exception 'Event is full' using errcode = 'P0001';
  end if;
  if to_regprocedure('public.validate_registration_answers(jsonb,jsonb)') is not null then
    perform public.validate_registration_answers(to_jsonb(v_event)->'registration_questions', coalesce(p_registration_data, '{}'::jsonb));
  end if;

  insert into public.event_registrations (event_id, user_id, status, payment_status, team_name, registration_data, participant_count)
  values (p_event_id, v_uid, 'registered',
          case when v_event.fee > 0 then 'created'::public.payment_status else null end,
          p_team_name, p_registration_data, p_participant_count)
  on conflict (event_id, user_id) do update
    set status = 'registered',
        payment_status = case when v_event.fee > 0 then
                           case when public.event_registrations.payment_status = 'paid' then 'paid'::public.payment_status
                                else 'created'::public.payment_status end
                         else null end,
        team_name = excluded.team_name,
        registration_data = excluded.registration_data,
        participant_count = excluded.participant_count
  returning * into v_reg;

  return v_reg;
end;
$$;



-- ######## 2026-10-13_opportunities ########
-- Patch: internships & jobs (postings, applications, private resume bucket).
-- Paste into Supabase -> SQL Editor -> Run (safe to re-run). Re-running supabase/schema.sql does the same.

-- >>> 10e. Internships & jobs ----------------------------------------------------------
create table if not exists public.opportunities (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid references public.clubs (id) on delete cascade,
  posted_by      uuid references public.users (id) on delete set null,
  kind           text not null check (kind in ('internship', 'job')),
  title          text not null check (char_length(title) between 3 and 140),
  company        text not null check (char_length(company) between 2 and 140),
  location       text check (char_length(location) <= 140),
  mode           text not null default 'onsite' check (mode in ('remote', 'onsite', 'hybrid')),
  stipend        text check (char_length(stipend) <= 80),
  description    text not null check (char_length(description) between 20 and 10000),
  skills         text[] not null default '{}' check (cardinality(skills) <= 20),
  eligibility    text check (char_length(eligibility) <= 500),
  openings       integer check (openings is null or openings between 1 and 10000),
  apply_deadline timestamptz,
  status         text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_opportunities_status on public.opportunities (status, apply_deadline);
create index if not exists idx_opportunities_club on public.opportunities (club_id);

create table if not exists public.opportunity_applications (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id        uuid not null references public.users (id) on delete cascade,
  resume_path    text check (resume_path is null or char_length(resume_path) <= 300),
  cover_note     text check (cover_note is null or char_length(cover_note) <= 3000),
  phone          text check (phone is null or char_length(phone) <= 30),
  portfolio_url  text check (portfolio_url is null or (portfolio_url ~* '^https?://' and char_length(portfolio_url) <= 500)),
  status         text not null default 'applied' check (status in ('applied', 'shortlisted', 'rejected', 'hired')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint opportunity_applications_unique unique (opportunity_id, user_id)
);
create index if not exists idx_applications_user on public.opportunity_applications (user_id);

create or replace trigger trg_opportunities_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();
create or replace trigger trg_applications_updated_at before update on public.opportunity_applications
  for each row execute function public.set_updated_at();

-- Owner/admin of the posting club (or a super admin for platform-wide postings)
create or replace function public.can_manage_opportunity(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_super_admin()
      or (p_club_id is not null and public.is_club_role(p_club_id, array['owner','admin']::public.club_role[]));
$$;

create or replace function public.opportunity_open(p_opportunity_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.opportunities o where o.id = p_opportunity_id and o.status = 'published'
                 and (o.apply_deadline is null or o.apply_deadline > now()));
$$;

-- Applicants can only create 'applied' rows pointing at their own resume folder
create or replace function public.guard_application()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if public.is_trusted_caller() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'applied';
    if new.resume_path is not null and new.resume_path not like (auth.uid()::text || '/%') then
      raise exception 'Invalid resume path' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create or replace trigger trg_opportunity_applications_guard
  before insert on public.opportunity_applications
  for each row execute function public.guard_application();

create or replace function public.trg_notify_application_status()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_title text; v_company text;
begin
  if new.status is distinct from old.status and new.status <> 'applied' then
    select title, company into v_title, v_company from public.opportunities where id = new.opportunity_id;
    perform public.notify_users(array[new.user_id],
      case new.status when 'shortlisted' then 'Shortlisted: ' when 'hired' then 'Offer: ' else 'Update: ' end || v_title || ' at ' || v_company,
      case new.status when 'shortlisted' then 'You have been shortlisted. The team will contact you.'
                      when 'hired' then 'Congratulations, you have been selected!'
                      else 'The team has decided not to move forward this time.' end,
      '/dashboard/student/applications');
  end if;
  return null;
end;
$$;
create or replace trigger trg_opportunity_applications_notify
  after update of status on public.opportunity_applications
  for each row execute function public.trg_notify_application_status();

alter table public.opportunities enable row level security;
alter table public.opportunity_applications enable row level security;

drop policy if exists opportunities_select_public on public.opportunities;
create policy opportunities_select_public on public.opportunities
  for select to anon, authenticated using (status in ('published', 'closed'));
drop policy if exists opportunities_select_staff on public.opportunities;
create policy opportunities_select_staff on public.opportunities
  for select to authenticated using (public.can_manage_opportunity(club_id));
drop policy if exists opportunities_insert on public.opportunities;
create policy opportunities_insert on public.opportunities
  for insert to authenticated with check (posted_by = auth.uid() and public.can_manage_opportunity(club_id));
drop policy if exists opportunities_update on public.opportunities;
create policy opportunities_update on public.opportunities
  for update to authenticated using (public.can_manage_opportunity(club_id)) with check (public.can_manage_opportunity(club_id));
drop policy if exists opportunities_delete on public.opportunities;
create policy opportunities_delete on public.opportunities
  for delete to authenticated using (public.can_manage_opportunity(club_id));

drop policy if exists applications_select_own on public.opportunity_applications;
create policy applications_select_own on public.opportunity_applications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists applications_insert_own on public.opportunity_applications;
create policy applications_insert_own on public.opportunity_applications
  for insert to authenticated with check (user_id = auth.uid() and public.opportunity_open(opportunity_id));
drop policy if exists applications_withdraw_own on public.opportunity_applications;
create policy applications_withdraw_own on public.opportunity_applications
  for delete to authenticated using (user_id = auth.uid() and status = 'applied');
drop policy if exists applications_select_staff on public.opportunity_applications;
create policy applications_select_staff on public.opportunity_applications
  for select to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_applications.opportunity_id and public.can_manage_opportunity(o.club_id)));
drop policy if exists applications_update_staff on public.opportunity_applications;
create policy applications_update_staff on public.opportunity_applications
  for update to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_applications.opportunity_id and public.can_manage_opportunity(o.club_id)))
  with check (exists (select 1 from public.opportunities o where o.id = opportunity_applications.opportunity_id and public.can_manage_opportunity(o.club_id)));

-- Staff may only change the status; applicants can't edit after applying (withdraw + re-apply instead)
revoke update on public.opportunity_applications from authenticated;
grant update (status) on public.opportunity_applications to authenticated;
revoke update on public.opportunities from authenticated;
grant update (kind, title, company, location, mode, stipend, description, skills, eligibility, openings, apply_deadline, status)
  on public.opportunities to authenticated;
revoke all on public.opportunity_applications from anon;
revoke all on public.opportunities from anon;
grant select on public.opportunities to anon;

-- Applicants' profile cards are visible to the posting club's staff (name/email/college only via users RLS)
create or replace function public.can_view_applicant(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.opportunity_applications a join public.opportunities o on o.id = a.opportunity_id
                 where a.user_id = target and public.can_manage_opportunity(o.club_id));
$$;
drop policy if exists users_select_applicant on public.users;
create policy users_select_applicant on public.users
  for select to authenticated using (public.can_view_applicant(id));

-- Private resume bucket: resumes/<user id>/<file>; applicants manage their own folder, staff read via the server
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resumes own folder insert" on storage.objects;
create policy "resumes own folder insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "resumes own folder read" on storage.objects;
create policy "resumes own folder read" on storage.objects
  for select to authenticated using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "resumes own folder delete" on storage.objects;
create policy "resumes own folder delete" on storage.objects
  for delete to authenticated using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
-- <<< 10e



-- ######## 2026-10-13_portfolio ########
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
