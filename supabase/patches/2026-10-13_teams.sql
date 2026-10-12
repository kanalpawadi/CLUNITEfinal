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

select pg_notify('pgrst', 'reload schema');
