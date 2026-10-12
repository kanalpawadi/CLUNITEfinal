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

select pg_notify('pgrst', 'reload schema');
