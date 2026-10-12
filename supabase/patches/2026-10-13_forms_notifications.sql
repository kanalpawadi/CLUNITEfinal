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

select pg_notify('pgrst', 'reload schema');
