-- =============================================================================
-- Clunite: complete database schema for a FRESH Supabase project
-- =============================================================================
-- * Idempotent: safe to run on an empty project and safe to run again.
-- * Run in the Supabase SQL Editor (as the default `postgres` role) or via
--   `supabase db push` (see supabase/README.md).
-- * Every table has RLS enabled. Writes that must never come from a browser
--   (payments, credential issuing, PIN handling) are done by the server with the
--   service-role key, or through SECURITY DEFINER functions that check auth.uid().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.global_role as enum ('super_admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.club_role as enum ('owner', 'admin', 'organizer', 'treasurer', 'member', 'guest');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_status as enum ('pending', 'active', 'suspended', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_tier as enum ('free', 'standard', 'premium', 'lifetime');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.registration_status as enum ('registered', 'waitlisted', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('created', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.credential_type as enum ('member_id', 'event_pass', 'staff_pass');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

-- users: one row per auth.users row (created by handle_new_user trigger)
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  phone       text,
  gender      varchar(50),
  avatar_url  text,
  global_role public.global_role not null default 'user',
  -- added: used by profile, signup and analytics screens
  college     text,
  branch      text,
  bio         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on column public.users.gender is 'Self-described gender (free text, max 50 chars). Used for default avatar selection and aggregate analytics only.';
create index if not exists idx_users_gender on public.users (gender);
create index if not exists idx_users_email on public.users (lower(email));

-- clubs
create table if not exists public.clubs (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  description         text,
  logo_url            text,
  official_email      text,
  is_active           boolean not null default true,
  created_by          uuid references public.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  -- added: used by club pages, discovery and analytics
  tagline             text,
  vision              text,
  category            text,
  college             text,
  founding_date       date,
  contact_email       text,
  faculty_in_charge   text,
  banner_url          text,
  social_links        jsonb,
  is_verified         boolean not null default false,
  requires_approval   boolean not null default false,
  members_count       integer not null default 0,
  events_hosted_count integer not null default 0,
  credibility_score   numeric(4,2) not null default 0,
  updated_at          timestamptz not null default now()
);
create index if not exists idx_clubs_active on public.clubs (is_active);
create index if not exists idx_clubs_category on public.clubs (category);

-- pending_clubs: club data held until the official email proves ownership via PIN
create table if not exists public.pending_clubs (
  id               uuid primary key default gen_random_uuid(),
  official_email   text not null,
  pin              varchar(8) not null,
  club_data        jsonb not null,
  status           text not null default 'pending' check (status in ('pending', 'verified', 'expired')),
  expires_at       timestamptz not null default (now() + interval '48 hours'),
  created_at       timestamptz not null default now(),
  -- added: used by the create/verify club flow
  created_by       uuid references public.users (id) on delete set null,
  club_id          uuid references public.clubs (id) on delete set null,
  president_name   text,
  president_email  text,
  president_phone  text,
  used_count       integer not null default 0,
  max_uses         integer not null default 5,
  first_used_by    uuid references public.users (id) on delete set null,
  first_used_at    timestamptz,
  constraint unique_email_pin unique (official_email, pin)
);
comment on constraint unique_email_pin on public.pending_clubs
  is 'Ensures each PIN is unique per official email, preventing duplicate-email conflicts between pending clubs.';
create index if not exists idx_pending_clubs_email_name on public.pending_clubs (official_email, (club_data->>'name'));
create index if not exists idx_pending_clubs_created_by on public.pending_clubs (created_by);

-- membership_plans: seeded per club (Free, Standard, Premium, Lifetime)
create table if not exists public.membership_plans (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs (id) on delete cascade,
  name          text not null,
  tier          public.membership_tier not null,
  price         numeric(12,2) not null default 0 check (price >= 0),
  currency      text not null default 'INR',
  duration_days integer check (duration_days is null or duration_days > 0), -- NULL = no expiry
  benefits      jsonb not null default '[]'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint membership_plans_club_name_key unique (club_id, name)
);
create index if not exists idx_membership_plans_club on public.membership_plans (club_id);

-- club_memberships
create table if not exists public.club_memberships (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs (id) on delete cascade,
  user_id          uuid not null references public.users (id) on delete cascade,
  role             public.club_role not null default 'member',
  plan_id          uuid references public.membership_plans (id) on delete set null,
  status           public.membership_status not null default 'pending',
  member_code      text unique,
  joined_at        timestamptz not null default now(),
  expires_at       timestamptz,
  -- added: read by the existing organizer screens
  is_owner         boolean generated always as (role = 'owner') stored,
  verified_via_pin boolean not null default false,
  invited_by       uuid references public.users (id) on delete set null,
  invited_at       timestamptz,
  updated_at       timestamptz not null default now(),
  constraint club_memberships_club_user_key unique (club_id, user_id)
);
create index if not exists idx_club_memberships_user on public.club_memberships (user_id);
create index if not exists idx_club_memberships_club_role on public.club_memberships (club_id, role);
create index if not exists idx_club_memberships_status on public.club_memberships (status);

-- events
create table if not exists public.events (
  id                    uuid primary key default gen_random_uuid(),
  club_id               uuid not null references public.clubs (id) on delete cascade,
  title                 text not null,
  description           text,
  venue                 text,
  starts_at             timestamptz not null,
  ends_at               timestamptz,
  capacity              integer check (capacity is null or capacity > 0),
  fee                   numeric(12,2) not null default 0 check (fee >= 0),
  -- `status` holds the lifecycle; is_published is derived so the two never disagree
  status                text not null default 'draft' check (status in ('draft', 'published', 'cancelled', 'completed')),
  is_published          boolean generated always as (status = 'published') stored,
  created_by            uuid references public.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  -- added: used by event creation, browsing and analytics screens
  college               text,
  category              text,
  type                  text check (type is null or type in ('workshop','competition','seminar','cultural','sports','hackathon','conference','networking')),
  mode                  text not null default 'offline' check (mode in ('online','offline','hybrid')),
  registration_deadline timestamptz,
  current_participants  integer not null default 0,
  prize_pool            numeric(12,2),
  tags                  text[],
  requirements          text[],
  contact_info          jsonb,
  image_url             text,
  team_size             text,
  duration              text,
  level                 text check (level is null or level in ('beginner','intermediate','advanced')),
  views                 integer not null default 0,
  updated_at            timestamptz not null default now(),
  constraint events_time_order check (ends_at is null or ends_at >= starts_at)
);
create index if not exists idx_events_club on public.events (club_id);
create index if not exists idx_events_starts_at on public.events (starts_at);
create index if not exists idx_events_status on public.events (status);

-- event_registrations
create table if not exists public.event_registrations (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events (id) on delete cascade,
  user_id           uuid not null references public.users (id) on delete cascade,
  status            public.registration_status not null default 'registered',
  payment_status    public.payment_status, -- NULL for free events
  created_at        timestamptz not null default now(),
  -- added: team / form data captured by the registration dialog
  team_name         text,
  registration_data jsonb,
  participant_count integer not null default 1 check (participant_count > 0),
  updated_at        timestamptz not null default now(),
  constraint event_registrations_event_user_key unique (event_id, user_id)
);
create index if not exists idx_event_registrations_user on public.event_registrations (user_id);
create index if not exists idx_event_registrations_event_status on public.event_registrations (event_id, status);

-- event_expenses (income and expense ledger per event)
create table if not exists public.event_expenses (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  category       text not null,
  amount         numeric(12,2) not null check (amount >= 0),
  vendor         text,
  payment_method text,
  incurred_at    timestamptz not null default now(),
  notes          text,
  created_by     uuid default auth.uid() references public.users (id) on delete set null, -- nullable: fixes NOT NULL + SET NULL conflict
  created_at     timestamptz not null default now(),
  type           text not null default 'expense' check (type in ('income', 'expense')),
  payment_id     uuid -- set for income rows created from a payment (FK added below)
);
create index if not exists idx_event_expenses_event_id on public.event_expenses (event_id);
create index if not exists idx_event_expenses_category on public.event_expenses (category);
create index if not exists idx_event_expenses_incurred_at on public.event_expenses (incurred_at);
create index if not exists idx_event_expenses_type on public.event_expenses (type);

-- payments: event fees AND membership plan purchases (written by the server only)
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  event_id            uuid references public.events (id) on delete set null,
  membership_id       uuid references public.club_memberships (id) on delete set null,
  razorpay_order_id   text not null unique,
  razorpay_payment_id text,
  amount              numeric(12,2) not null check (amount >= 0),
  currency            text not null default 'INR',
  status              public.payment_status not null default 'created',
  created_at          timestamptz not null default now(),
  -- added: denormalised for RLS and receipts
  club_id             uuid references public.clubs (id) on delete set null,
  plan_id             uuid references public.membership_plans (id) on delete set null,
  registration_id     uuid references public.event_registrations (id) on delete set null,
  purpose             text not null check (purpose in ('event', 'membership')),
  provider            text not null default 'mock' check (provider in ('mock', 'razorpay')),
  receipt_no          text unique,
  failure_reason      text,
  paid_at             timestamptz,
  updated_at          timestamptz not null default now(),
  constraint payments_target check (
    (purpose = 'event' and event_id is not null) or (purpose = 'membership' and plan_id is not null)
  )
);
create index if not exists idx_payments_user on public.payments (user_id);
create index if not exists idx_payments_club on public.payments (club_id);
create index if not exists idx_payments_event on public.payments (event_id);

do $$ begin
  alter table public.event_expenses
    add constraint event_expenses_payment_id_fkey foreign key (payment_id) references public.payments (id) on delete set null;
exception when duplicate_object then null; end $$;
create unique index if not exists uq_event_expenses_payment on public.event_expenses (payment_id) where payment_id is not null;

-- id_credentials: what a QR token points at (bump token_version to revoke all old QRs)
create table if not exists public.id_credentials (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  club_id         uuid references public.clubs (id) on delete cascade,
  credential_type public.credential_type not null default 'member_id',
  token_version   integer not null default 1 check (token_version > 0),
  issued_at       timestamptz not null default now(),
  revoked_at      timestamptz,
  constraint id_credentials_unique unique nulls not distinct (user_id, club_id, credential_type)
);
create index if not exists idx_id_credentials_user on public.id_credentials (user_id);

-- attendance
create table if not exists public.attendance (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references public.users (id) on delete set null,
  constraint attendance_event_user_key unique (event_id, user_id)
);
create index if not exists idx_attendance_event on public.attendance (event_id);

-- club_access_otps: short-lived codes emailed to a club's official address (server only)
create table if not exists public.club_access_otps (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  code          varchar(6) not null,
  sent_to_email text not null,
  expires_at    timestamptz not null,
  status        text not null default 'pending' check (status in ('pending', 'used', 'expired')),
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_club_access_otps_lookup on public.club_access_otps (club_id, code, status);

-- Pending-club view without the PIN column (RLS of the base table applies)
create or replace view public.pending_clubs_public
with (security_invoker = true) as
  select id, status, expires_at, created_by, created_at, club_data, official_email
  from public.pending_clubs;

-- -----------------------------------------------------------------------------
-- 3. Helper functions (SECURITY DEFINER so policies don't recurse through RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.global_role = 'super_admin'
  );
$$;

create or replace function public.is_club_role(club uuid, roles public.club_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.club_memberships m
    where m.club_id = club
      and m.user_id = auth.uid()
      and m.role = any (roles)
      and m.status = 'active'
  );
$$;

-- Staff of the club that owns an event
create or replace function public.is_event_staff(event uuid, roles public.club_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    join public.club_memberships m on m.club_id = e.club_id
    where e.id = event
      and m.user_id = auth.uid()
      and m.role = any (roles)
      and m.status = 'active'
  );
$$;

-- True when the caller is staff of a club the target user belongs to or registered with
create or replace function public.can_view_user(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.club_memberships staff
    where staff.user_id = auth.uid()
      and staff.status = 'active'
      and staff.role in ('owner', 'admin', 'organizer', 'treasurer')
      and (
        exists (select 1 from public.club_memberships m
                where m.club_id = staff.club_id and m.user_id = target)
        or exists (select 1 from public.event_registrations r
                   join public.events e on e.id = r.event_id
                   where e.club_id = staff.club_id and r.user_id = target)
      )
  );
$$;

-- Whether the caller is the service role / database owner (SQL editor, server)
create or replace function public.is_trusted_caller()
returns boolean
language sql stable set search_path = ''
as $$
  -- current_user is `postgres` inside SECURITY DEFINER RPCs and in the SQL editor,
  -- and `service_role` for the server's service-role client.
  select coalesce(auth.jwt()->>'role', '') = 'service_role'
      or current_user in ('postgres', 'supabase_admin', 'service_role');
$$;

create or replace function public.slugify(input text)
returns text
language sql immutable set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- 4. Trigger functions
-- -----------------------------------------------------------------------------

-- 4.1 auth.users -> public.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name, phone, gender, avatar_url, college, branch)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'phone',
    left(new.raw_user_meta_data->>'gender', 50),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'college',
    new.raw_user_meta_data->>'branch'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill accounts that signed up before this schema existed
insert into public.users (id, email, full_name)
select au.id, coalesce(au.email, ''),
       coalesce(au.raw_user_meta_data->>'full_name', split_part(coalesce(au.email, ''), '@', 1))
from auth.users au
on conflict (id) do nothing;

-- Keep public.users.email in sync when the auth email changes
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create or replace trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- 4.2 updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['users','clubs','membership_plans','club_memberships','events','event_registrations','payments']
  loop
    execute format('create or replace trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- 4.3 member_code (CLB-XXXXXX, unambiguous alphabet, unique)
create or replace function public.generate_member_code()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  if tg_op = 'UPDATE' then
    new.member_code := old.member_code; -- immutable once issued
    return new;
  end if;
  loop
    candidate := 'CLB-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.club_memberships where member_code = candidate);
  end loop;
  new.member_code := candidate;
  return new;
end;
$$;

create or replace trigger trg_club_memberships_member_code
  before insert or update of member_code on public.club_memberships
  for each row execute function public.generate_member_code();

-- 4.4 Membership guard: who may set which role/status, and expiry bookkeeping
create or replace function public.guard_club_membership()
returns trigger
language plpgsql set search_path = '' -- SECURITY INVOKER on purpose: trust depends on current_user
as $$
declare
  v_trusted boolean := public.is_trusted_caller() or public.is_super_admin();
  v_is_owner boolean := public.is_club_role(new.club_id, array['owner']::public.club_role[]);
  v_is_manager boolean := public.is_club_role(new.club_id, array['owner','admin','organizer']::public.club_role[]);
  v_duration int;
begin
  if not v_trusted then
    if tg_op = 'INSERT' then
      if new.user_id = auth.uid() and not v_is_manager then
        -- self-join: plain member, pending or (free plan, no approval) active
        new.role := 'member';
        new.invited_by := null;
        new.verified_via_pin := false;
        if new.status not in ('pending', 'active') then
          new.status := 'pending';
        end if;
        new.expires_at := null;
      elsif not v_is_manager then
        raise exception 'Not allowed to add members to this club' using errcode = '42501';
      end if;
    else
      if old.user_id = auth.uid() and not v_is_manager then
        -- members may only cancel their own membership
        if new.status <> 'cancelled' or new.role <> old.role or new.plan_id is distinct from old.plan_id then
          raise exception 'Members can only cancel their own membership' using errcode = '42501';
        end if;
      end if;
      new.club_id := old.club_id;
      new.user_id := old.user_id;
    end if;

    -- only the owner can grant/remove ownership or edit the owner's row
    if (new.role = 'owner' or (tg_op = 'UPDATE' and old.role = 'owner')) and not v_is_owner then
      raise exception 'Only the club owner can change ownership' using errcode = '42501';
    end if;
    -- managers can't make other managers above admin unless they are owner/admin
    if new.role in ('admin', 'treasurer') and (tg_op = 'INSERT' or new.role is distinct from old.role)
       and not public.is_club_role(new.club_id, array['owner','admin']::public.club_role[]) then
      raise exception 'Only owners and admins can grant admin or treasurer roles' using errcode = '42501';
    end if;
  end if;

  -- expiry: set when a membership becomes active and has a timed plan
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') and new.expires_at is null and new.plan_id is not null then
    select duration_days into v_duration from public.membership_plans where id = new.plan_id;
    if v_duration is not null then
      new.expires_at := now() + make_interval(days => v_duration);
    end if;
  end if;
  if new.status = 'active' and tg_op = 'UPDATE' and old.status <> 'active' then
    new.joined_at := now();
  end if;
  return new;
end;
$$;

create or replace trigger trg_club_memberships_guard
  before insert or update on public.club_memberships
  for each row execute function public.guard_club_membership();

-- 4.5 Self-join check helper used by the INSERT policy (free plan, no approval)
create or replace function public.can_self_activate(club uuid, plan uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.clubs c
    join public.membership_plans p on p.club_id = c.id
    where c.id = club and p.id = plan
      and c.is_active and not c.requires_approval
      and p.is_active and p.price = 0
  );
$$;

-- 4.6 Counters (security definer so a member's own write can refresh club/event counters)
create or replace function public.refresh_club_members_count()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_club uuid := coalesce(new.club_id, old.club_id);
begin
  update public.clubs
     set members_count = (select count(*) from public.club_memberships
                          where club_id = v_club and status = 'active')
   where id = v_club;
  return null;
end;
$$;

create or replace trigger trg_club_memberships_count
  after insert or update of status or delete on public.club_memberships
  for each row execute function public.refresh_club_members_count();

create or replace function public.refresh_event_participants()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_event uuid := coalesce(new.event_id, old.event_id);
begin
  update public.events
     set current_participants = coalesce((select sum(participant_count) from public.event_registrations
                                          where event_id = v_event and status = 'registered'), 0)
   where id = v_event;
  return null;
end;
$$;

create or replace trigger trg_event_registrations_count
  after insert or update of status, participant_count or delete on public.event_registrations
  for each row execute function public.refresh_event_participants();

create or replace function public.refresh_club_events_count()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_club uuid := coalesce(new.club_id, old.club_id);
begin
  update public.clubs
     set events_hosted_count = (select count(*) from public.events where club_id = v_club and status <> 'draft')
   where id = v_club;
  return null;
end;
$$;

create or replace trigger trg_events_count
  after insert or update of status or delete on public.events
  for each row execute function public.refresh_club_events_count();

-- 4.7 Registration guard: members may only cancel; payment_status is server-only
create or replace function public.guard_event_registration()
returns trigger
language plpgsql set search_path = '' -- SECURITY INVOKER on purpose: trust depends on current_user
as $$
begin
  if public.is_trusted_caller() or public.is_super_admin() then
    return new;
  end if;
  if new.payment_status is distinct from old.payment_status
     or new.event_id <> old.event_id or new.user_id <> old.user_id then
    raise exception 'Not allowed to change payment or ownership fields' using errcode = '42501';
  end if;
  if not public.is_event_staff(old.event_id, array['owner','admin','organizer']::public.club_role[]) then
    if new.status <> old.status and new.status <> 'cancelled' then
      raise exception 'You can only cancel your registration' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger trg_event_registrations_guard
  before update on public.event_registrations
  for each row execute function public.guard_event_registration();

-- 4.8 Clubs: slug + default plans
create or replace function public.set_club_slug()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if new.slug is null or new.slug = '' then
    base := nullif(public.slugify(new.name), '');
    base := coalesce(base, 'club');
    candidate := base;
    while exists (select 1 from public.clubs where slug = candidate and id <> new.id) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  else
    new.slug := public.slugify(new.slug);
  end if;
  return new;
end;
$$;

create or replace trigger trg_clubs_slug
  before insert or update of slug on public.clubs
  for each row execute function public.set_club_slug();

create or replace function public.seed_club_plans()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.membership_plans (club_id, name, tier, price, duration_days, benefits)
  values
    (new.id, 'Free',     'free',     0,    null, '["Join club updates", "Register for open events"]'::jsonb),
    (new.id, 'Standard', 'standard', 299,  180,  '["Member pricing on events", "Digital member ID"]'::jsonb),
    (new.id, 'Premium',  'premium',  599,  365,  '["Everything in Standard", "Priority registration", "Members-only sessions"]'::jsonb),
    (new.id, 'Lifetime', 'lifetime', 2499, null, '["Everything in Premium", "Never expires"]'::jsonb)
  on conflict (club_id, name) do nothing;
  return null;
end;
$$;

create or replace trigger trg_clubs_seed_plans
  after insert on public.clubs
  for each row execute function public.seed_club_plans();

-- -----------------------------------------------------------------------------
-- 5. RPCs (called from the app)
-- -----------------------------------------------------------------------------

-- Atomic event registration for the signed-in user
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

-- View counter (anyone may bump a published event's views)
create or replace function public.increment_event_views(p_event_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.events set views = views + 1 where id = p_event_id and status = 'published';
$$;

-- Verify a pending club's PIN and create the club with the caller as owner.
-- Returns NULL for a wrong PIN (attempts are counted; max_uses attempts allowed).
create or replace function public.verify_and_create_club(
  p_pending_club_id uuid,
  p_pin text,
  p_banner_url text default null
)
returns public.clubs
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pending public.pending_clubs;
  v_club public.clubs;
  v_free_plan uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_pending from public.pending_clubs where id = p_pending_club_id for update;
  if not found or v_pending.status <> 'pending' then
    raise exception 'Pending club not found or already verified' using errcode = 'P0002';
  end if;
  if v_pending.created_by is distinct from v_uid then
    raise exception 'This pending club belongs to another account' using errcode = '42501';
  end if;
  if v_pending.expires_at < now() then
    update public.pending_clubs set status = 'expired' where id = v_pending.id;
    raise exception 'Verification PIN has expired' using errcode = 'P0001';
  end if;
  if v_pending.used_count >= v_pending.max_uses then
    raise exception 'Too many attempts for this PIN' using errcode = 'P0001';
  end if;
  if v_pending.pin <> p_pin then
    -- return instead of raising so the attempt counter is committed
    update public.pending_clubs set used_count = used_count + 1 where id = v_pending.id;
    return null;
  end if;

  insert into public.clubs (name, tagline, description, vision, category, college, founding_date,
                            contact_email, official_email, faculty_in_charge, banner_url, is_verified, created_by)
  values (
    v_pending.club_data->>'name',
    v_pending.club_data->>'tagline',
    v_pending.club_data->>'description',
    v_pending.club_data->>'vision',
    v_pending.club_data->>'category',
    v_pending.club_data->>'college',
    nullif(v_pending.club_data->>'founding_date', '')::date,
    coalesce(v_pending.club_data->>'contact_email', v_pending.official_email),
    v_pending.official_email,
    v_pending.club_data->>'faculty_in_charge',
    p_banner_url,
    true,
    v_uid
  )
  returning * into v_club;

  select id into v_free_plan from public.membership_plans where club_id = v_club.id and tier = 'free' limit 1;

  insert into public.club_memberships (club_id, user_id, role, status, plan_id, verified_via_pin)
  values (v_club.id, v_uid, 'owner', 'active', v_free_plan, true);

  update public.pending_clubs
     set status = 'verified', club_id = v_club.id, used_count = used_count + 1,
         first_used_by = v_uid, first_used_at = now()
   where id = v_pending.id;

  select * into v_club from public.clubs where id = v_club.id;
  return v_club;
end;
$$;

-- Add (or promote) a user to a club staff role by email; caller must be owner/admin
create or replace function public.add_club_staff(p_club_id uuid, p_email text, p_role public.club_role default 'admin')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_target public.users;
begin
  if not (public.is_club_role(p_club_id, array['owner','admin']::public.club_role[]) or public.is_super_admin()) then
    raise exception 'Only club owners and admins can add staff' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'Ownership cannot be granted this way' using errcode = '42501';
  end if;
  if p_role in ('admin', 'treasurer') and not public.is_club_role(p_club_id, array['owner','admin']::public.club_role[]) then
    raise exception 'Only owners and admins can grant this role' using errcode = '42501';
  end if;

  select * into v_target from public.users u where lower(u.email) = lower(trim(p_email));
  if not found then
    raise exception 'No account found with that email. Ask them to sign up first.' using errcode = 'P0002';
  end if;

  insert into public.club_memberships as m (club_id, user_id, role, status, invited_by, invited_at)
  values (p_club_id, v_target.id, p_role, 'active', auth.uid(), now())
  on conflict (club_id, user_id) do update
    set role = case when m.role = 'owner' then m.role else excluded.role end,
        status = 'active', invited_by = excluded.invited_by, invited_at = excluded.invited_at;

  return jsonb_build_object('user_id', v_target.id, 'full_name', v_target.full_name,
                            'email', v_target.email, 'role', p_role);
end;
$$;

-- Finalise a payment (server only). Idempotent: a second call for a paid order is a no-op.
create or replace function public.finalize_payment(
  p_order_id text,
  p_payment_id text,
  p_success boolean,
  p_failure_reason text default null
)
returns public.payments
language plpgsql security definer set search_path = ''
as $$
declare
  v_pay public.payments;
  v_plan public.membership_plans;
  v_member public.club_memberships;
  v_base timestamptz;
begin
  select * into v_pay from public.payments where razorpay_order_id = p_order_id for update;
  if not found then
    raise exception 'Unknown order' using errcode = 'P0002';
  end if;
  if v_pay.status = 'paid' then
    return v_pay; -- already processed (webhook + verify race, or replay)
  end if;

  if not p_success then
    update public.payments
       set status = 'failed', razorpay_payment_id = coalesce(p_payment_id, razorpay_payment_id),
           failure_reason = left(p_failure_reason, 500)
     where id = v_pay.id
    returning * into v_pay;
    if v_pay.registration_id is not null then
      update public.event_registrations set payment_status = 'failed'
       where id = v_pay.registration_id and payment_status is distinct from 'paid';
    end if;
    return v_pay;
  end if;

  update public.payments
     set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now(), failure_reason = null,
         receipt_no = coalesce(receipt_no, 'RCPT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 8)))
   where id = v_pay.id
  returning * into v_pay;

  if v_pay.purpose = 'event' then
    update public.event_registrations set payment_status = 'paid'
     where id = v_pay.registration_id;
    insert into public.event_expenses (event_id, category, amount, vendor, payment_method, notes, created_by, type, payment_id)
    values (v_pay.event_id, 'Registration fees', v_pay.amount, null, v_pay.provider,
            'Order ' || v_pay.razorpay_order_id, v_pay.user_id, 'income', v_pay.id)
    on conflict do nothing;
  else
    select * into v_plan from public.membership_plans where id = v_pay.plan_id;
    select * into v_member from public.club_memberships
     where club_id = v_plan.club_id and user_id = v_pay.user_id for update;

    -- renewal of the same plan extends from the current expiry; upgrades start now
    v_base := case when found and v_member.status = 'active' and v_member.plan_id = v_plan.id
                        and v_member.expires_at is not null and v_member.expires_at > now()
                   then v_member.expires_at else now() end;

    insert into public.club_memberships as m (club_id, user_id, role, plan_id, status, expires_at)
    values (v_plan.club_id, v_pay.user_id, 'member', v_plan.id, 'active',
            case when v_plan.duration_days is null then null else v_base + make_interval(days => v_plan.duration_days) end)
    on conflict (club_id, user_id) do update
      set plan_id = excluded.plan_id,
          status = 'active',
          expires_at = excluded.expires_at
    returning * into v_member;

    update public.payments set membership_id = v_member.id where id = v_pay.id returning * into v_pay;
  end if;

  return v_pay;
end;
$$;

-- Mark lapsed memberships as expired (schedule with pg_cron, or call from a cron route)
create or replace function public.expire_memberships()
returns integer
language sql security definer set search_path = ''
as $$
  with updated as (
    update public.club_memberships
       set status = 'expired'
     where status = 'active' and expires_at is not null and expires_at < now()
       and role not in ('owner', 'admin', 'organizer', 'treasurer')
    returning 1
  )
  select count(*)::int from updated;
$$;

-- -----------------------------------------------------------------------------
-- 6. Privileges (defence in depth on top of RLS)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on public.clubs, public.events, public.membership_plans to anon;

-- users: only profile fields are writable by the owner of the row
revoke insert, update, delete on public.users from authenticated;
grant update (full_name, phone, gender, avatar_url, college, branch, bio) on public.users to authenticated;

-- clubs: created only via verify_and_create_club; staff may edit presentation fields
revoke insert, update, delete on public.clubs from authenticated;
grant update (name, description, logo_url, banner_url, tagline, vision, category, college, founding_date,
              contact_email, faculty_in_charge, social_links, requires_approval, is_active)
  on public.clubs to authenticated;

-- pending clubs: server only, except reading your own (PIN column never readable)
revoke all on public.pending_clubs from authenticated;
grant select (id, official_email, club_data, status, expires_at, created_at, created_by) on public.pending_clubs to authenticated;
grant select on public.pending_clubs_public to authenticated;

-- memberships: no client control of member_code/expiry/ownership flags
revoke insert, update on public.club_memberships from authenticated;
grant insert (club_id, user_id, role, plan_id, status) on public.club_memberships to authenticated;
grant update (role, status) on public.club_memberships to authenticated;

-- registrations: created via register_for_event(); payment_status is server-only
revoke insert, update on public.event_registrations from authenticated;
grant update (status, team_name, registration_data) on public.event_registrations to authenticated;

-- events: counters are maintained by triggers / RPC
revoke update on public.events from authenticated;
grant update (title, description, venue, starts_at, ends_at, capacity, fee, status, college, category, type, mode,
              registration_deadline, prize_pool, tags, requirements, contact_info, image_url, team_size,
              duration, level, club_id)
  on public.events to authenticated;

-- payments, credentials, OTPs: server only
revoke insert, update, delete on public.payments from authenticated;
revoke insert, delete on public.id_credentials from authenticated;
revoke update on public.id_credentials from authenticated;
grant update (revoked_at, token_version) on public.id_credentials to authenticated;
revoke all on public.club_access_otps from authenticated;

-- functions
revoke execute on function public.finalize_payment(text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.expire_memberships() from public, anon, authenticated;
revoke execute on function public.register_for_event(uuid, text, jsonb, integer) from public, anon;
revoke execute on function public.verify_and_create_club(uuid, text, text) from public, anon;
revoke execute on function public.add_club_staff(uuid, text, public.club_role) from public, anon;
grant execute on function public.register_for_event(uuid, text, jsonb, integer) to authenticated;
grant execute on function public.verify_and_create_club(uuid, text, text) to authenticated;
grant execute on function public.add_club_staff(uuid, text, public.club_role) to authenticated;
grant execute on function public.increment_event_views(uuid) to anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.finalize_payment(text, text, boolean, text) to service_role;
    grant execute on function public.expire_memberships() to service_role;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.users               enable row level security;
alter table public.clubs               enable row level security;
alter table public.pending_clubs       enable row level security;
alter table public.membership_plans    enable row level security;
alter table public.club_memberships    enable row level security;
alter table public.events              enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_expenses      enable row level security;
alter table public.payments            enable row level security;
alter table public.id_credentials      enable row level security;
alter table public.attendance          enable row level security;
alter table public.club_access_otps    enable row level security;

-- users ------------------------------------------------------------------------
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select to authenticated using (id = auth.uid());

drop policy if exists users_select_staff on public.users;
create policy users_select_staff on public.users
  for select to authenticated using (public.can_view_user(id));

drop policy if exists users_select_super on public.users;
create policy users_select_super on public.users
  for select to authenticated using (public.is_super_admin());

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists users_all_super on public.users;
create policy users_all_super on public.users
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- clubs ------------------------------------------------------------------------
drop policy if exists clubs_select_public on public.clubs;
create policy clubs_select_public on public.clubs
  for select to anon, authenticated using (is_active);

drop policy if exists clubs_select_members on public.clubs;
create policy clubs_select_members on public.clubs
  for select to authenticated
  using (public.is_club_role(id, array['owner','admin','organizer','treasurer']::public.club_role[]));

drop policy if exists clubs_update_admins on public.clubs;
create policy clubs_update_admins on public.clubs
  for update to authenticated
  using (public.is_club_role(id, array['owner','admin']::public.club_role[]))
  with check (public.is_club_role(id, array['owner','admin']::public.club_role[]));

drop policy if exists clubs_all_super on public.clubs;
create policy clubs_all_super on public.clubs
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- pending_clubs ---------------------------------------------------------------
drop policy if exists pending_clubs_select_own on public.pending_clubs;
create policy pending_clubs_select_own on public.pending_clubs
  for select to authenticated using (created_by = auth.uid());

drop policy if exists pending_clubs_select_super on public.pending_clubs;
create policy pending_clubs_select_super on public.pending_clubs
  for select to authenticated using (public.is_super_admin());

-- membership_plans ------------------------------------------------------------
drop policy if exists plans_select_public on public.membership_plans;
create policy plans_select_public on public.membership_plans
  for select to anon, authenticated
  using (is_active and exists (select 1 from public.clubs c where c.id = membership_plans.club_id and c.is_active));

drop policy if exists plans_select_staff on public.membership_plans;
create policy plans_select_staff on public.membership_plans
  for select to authenticated
  using (public.is_club_role(club_id, array['owner','admin','treasurer']::public.club_role[]));

drop policy if exists plans_write_admins on public.membership_plans;
create policy plans_write_admins on public.membership_plans
  for all to authenticated
  using (public.is_club_role(club_id, array['owner','admin']::public.club_role[]))
  with check (public.is_club_role(club_id, array['owner','admin']::public.club_role[]));

drop policy if exists plans_all_super on public.membership_plans;
create policy plans_all_super on public.membership_plans
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- club_memberships ------------------------------------------------------------
drop policy if exists memberships_select_own on public.club_memberships;
create policy memberships_select_own on public.club_memberships
  for select to authenticated using (user_id = auth.uid());

drop policy if exists memberships_select_staff on public.club_memberships;
create policy memberships_select_staff on public.club_memberships
  for select to authenticated
  using (public.is_club_role(club_id, array['owner','admin','organizer','treasurer']::public.club_role[]));

drop policy if exists memberships_insert_self on public.club_memberships;
create policy memberships_insert_self on public.club_memberships
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'member'
    and (status = 'pending' or (status = 'active' and public.can_self_activate(club_id, plan_id)))
  );

drop policy if exists memberships_insert_staff on public.club_memberships;
create policy memberships_insert_staff on public.club_memberships
  for insert to authenticated
  with check (public.is_club_role(club_id, array['owner','admin','organizer']::public.club_role[]));

drop policy if exists memberships_update_own on public.club_memberships;
create policy memberships_update_own on public.club_memberships
  for update to authenticated
  using (user_id = auth.uid() and role <> 'owner')
  with check (user_id = auth.uid() and status = 'cancelled');

drop policy if exists memberships_update_staff on public.club_memberships;
create policy memberships_update_staff on public.club_memberships
  for update to authenticated
  using (public.is_club_role(club_id, array['owner','admin','organizer']::public.club_role[]))
  with check (public.is_club_role(club_id, array['owner','admin','organizer']::public.club_role[]));

drop policy if exists memberships_delete_own on public.club_memberships;
create policy memberships_delete_own on public.club_memberships
  for delete to authenticated using (user_id = auth.uid() and role <> 'owner');

drop policy if exists memberships_delete_admins on public.club_memberships;
create policy memberships_delete_admins on public.club_memberships
  for delete to authenticated
  using (role <> 'owner' and public.is_club_role(club_id, array['owner','admin']::public.club_role[]));

drop policy if exists memberships_all_super on public.club_memberships;
create policy memberships_all_super on public.club_memberships
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- events ----------------------------------------------------------------------
drop policy if exists events_select_published on public.events;
create policy events_select_published on public.events
  for select to anon, authenticated using (is_published);

drop policy if exists events_select_staff on public.events;
create policy events_select_staff on public.events
  for select to authenticated
  using (public.is_club_role(club_id, array['owner','admin','organizer','treasurer']::public.club_role[]));

drop policy if exists events_select_registered on public.events;
create policy events_select_registered on public.events
  for select to authenticated
  using (exists (select 1 from public.event_registrations r where r.event_id = events.id and r.user_id = auth.uid()));

drop policy if exists events_insert_staff on public.events;
create policy events_insert_staff on public.events
  for insert to authenticated
  with check (public.is_club_role(club_id, array['owner','admin','organizer']::public.club_role[]));

drop policy if exists events_update_staff on public.events;
create policy events_update_staff on public.events
  for update to authenticated
  using (public.is_club_role(club_id, array['owner','admin','organizer']::public.club_role[]))
  with check (public.is_club_role(club_id, array['owner','admin','organizer']::public.club_role[]));

drop policy if exists events_delete_staff on public.events;
create policy events_delete_staff on public.events
  for delete to authenticated
  using (public.is_club_role(club_id, array['owner','admin']::public.club_role[]));

drop policy if exists events_all_super on public.events;
create policy events_all_super on public.events
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- event_registrations -----------------------------------------------------------
drop policy if exists registrations_select_own on public.event_registrations;
create policy registrations_select_own on public.event_registrations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists registrations_update_own on public.event_registrations;
create policy registrations_update_own on public.event_registrations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists registrations_delete_own on public.event_registrations;
create policy registrations_delete_own on public.event_registrations
  for delete to authenticated
  using (user_id = auth.uid() and payment_status is distinct from 'paid');

drop policy if exists registrations_select_staff on public.event_registrations;
create policy registrations_select_staff on public.event_registrations
  for select to authenticated
  using (public.is_event_staff(event_id, array['owner','admin','organizer','treasurer']::public.club_role[]));

drop policy if exists registrations_update_staff on public.event_registrations;
create policy registrations_update_staff on public.event_registrations
  for update to authenticated
  using (public.is_event_staff(event_id, array['owner','admin','organizer']::public.club_role[]))
  with check (public.is_event_staff(event_id, array['owner','admin','organizer']::public.club_role[]));

drop policy if exists registrations_all_super on public.event_registrations;
create policy registrations_all_super on public.event_registrations
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- event_expenses (owner/admin/treasurer) -----------------------------------------
do $$
begin
  drop policy if exists event_expenses_select on public.event_expenses;
  create policy event_expenses_select on public.event_expenses
    for select to authenticated
    using (public.is_event_staff(event_id, array['owner','admin','treasurer']::public.club_role[]) or public.is_super_admin());

  drop policy if exists event_expenses_insert on public.event_expenses;
  create policy event_expenses_insert on public.event_expenses
    for insert to authenticated
    with check (public.is_event_staff(event_id, array['owner','admin','treasurer']::public.club_role[]) or public.is_super_admin());

  drop policy if exists event_expenses_update on public.event_expenses;
  create policy event_expenses_update on public.event_expenses
    for update to authenticated
    using (public.is_event_staff(event_id, array['owner','admin','treasurer']::public.club_role[]) or public.is_super_admin())
    with check (public.is_event_staff(event_id, array['owner','admin','treasurer']::public.club_role[]) or public.is_super_admin());

  drop policy if exists event_expenses_delete on public.event_expenses;
  create policy event_expenses_delete on public.event_expenses
    for delete to authenticated
    using (public.is_event_staff(event_id, array['owner','admin','treasurer']::public.club_role[]) or public.is_super_admin());
end $$;

-- payments --------------------------------------------------------------------
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select to authenticated using (user_id = auth.uid());

drop policy if exists payments_select_finance on public.payments;
create policy payments_select_finance on public.payments
  for select to authenticated
  using (club_id is not null and public.is_club_role(club_id, array['owner','admin','treasurer']::public.club_role[]));

drop policy if exists payments_select_super on public.payments;
create policy payments_select_super on public.payments
  for select to authenticated using (public.is_super_admin());

-- id_credentials ------------------------------------------------------------------
drop policy if exists credentials_select_own on public.id_credentials;
create policy credentials_select_own on public.id_credentials
  for select to authenticated using (user_id = auth.uid());

drop policy if exists credentials_manage_staff on public.id_credentials;
create policy credentials_manage_staff on public.id_credentials
  for all to authenticated
  using (club_id is not null and public.is_club_role(club_id, array['owner','admin','organizer']::public.club_role[]))
  with check (club_id is not null and public.is_club_role(club_id, array['owner','admin','organizer']::public.club_role[]));

drop policy if exists credentials_all_super on public.id_credentials;
create policy credentials_all_super on public.id_credentials
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- attendance ------------------------------------------------------------------
drop policy if exists attendance_select_own on public.attendance;
create policy attendance_select_own on public.attendance
  for select to authenticated using (user_id = auth.uid());

drop policy if exists attendance_manage_staff on public.attendance;
create policy attendance_manage_staff on public.attendance
  for all to authenticated
  using (public.is_event_staff(event_id, array['owner','admin','organizer']::public.club_role[]))
  with check (public.is_event_staff(event_id, array['owner','admin','organizer']::public.club_role[]));

drop policy if exists attendance_all_super on public.attendance;
create policy attendance_all_super on public.attendance
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- club_access_otps: no client policies (service role only)

-- -----------------------------------------------------------------------------
-- 8. Storage buckets (public read; scoped writes)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',       'avatars',       true, 5242880,  array['image/jpeg','image/png','image/webp','image/gif']),
  ('club-logos',    'club-logos',    true, 5242880,  array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('club-banners',  'club-banners',  true, 10485760, array['image/jpeg','image/png','image/webp','image/gif']),
  ('event-banners', 'event-banners', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "clunite public read" on storage.objects;
create policy "clunite public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('avatars', 'club-logos', 'club-banners', 'event-banners'));

-- avatars/<user id>/<file>
drop policy if exists "avatars write own folder" on storage.objects;
create policy "avatars write own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars update own folder" on storage.objects;
create policy "avatars update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars delete own folder" on storage.objects;
create policy "avatars delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- club-logos/<club id>/<file> and event-banners/<club id>/<file>: club staff only
drop policy if exists "club assets write staff" on storage.objects;
create policy "club assets write staff" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('club-logos', 'event-banners')
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_club_role(((storage.foldername(name))[1])::uuid, array['owner','admin','organizer']::public.club_role[])
  );

drop policy if exists "club assets delete staff" on storage.objects;
create policy "club assets delete staff" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('club-logos', 'event-banners')
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_club_role(((storage.foldername(name))[1])::uuid, array['owner','admin']::public.club_role[])
  );
-- club-banners are uploaded by the server (service role) during club verification.

-- -----------------------------------------------------------------------------
-- 9. Reload PostgREST schema cache
-- -----------------------------------------------------------------------------
select pg_notify('pgrst', 'reload schema');
