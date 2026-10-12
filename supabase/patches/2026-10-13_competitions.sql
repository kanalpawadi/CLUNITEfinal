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

select pg_notify('pgrst', 'reload schema');
