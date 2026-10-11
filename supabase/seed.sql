-- =============================================================================
-- OPTIONAL DEMO DATA. Do NOT run in production.
-- =============================================================================
-- Run AFTER schema.sql and AFTER at least one account has signed up.
-- Everything created here is tagged "[DEMO]" and the club slug starts with
-- "demo-", so it is easy to find and remove (see the cleanup block at the end).
--
-- The demo club is owned by the account whose email you put in v_owner_email,
-- or by the earliest account if that email is not found.
-- Safe to run more than once.
-- =============================================================================

do $$
declare
  v_owner_email constant text := 'you@example.com'; -- change me (optional)
  v_owner uuid;
  v_club uuid;
  v_free uuid;
begin
  select id into v_owner from public.users where lower(email) = lower(v_owner_email);
  if v_owner is null then
    select id into v_owner from public.users order by created_at limit 1;
  end if;
  if v_owner is null then
    raise notice 'seed.sql: no users yet. Sign up once, then re-run this file.';
    return;
  end if;

  insert into public.clubs (name, slug, description, tagline, category, college, official_email, contact_email,
                            is_verified, created_by)
  values ('Demo Coding Club', 'demo-coding-club', '[DEMO] A sample club to explore Clunite.',
          'Build. Ship. Repeat.', 'Technical', 'Demo University', 'demo-club@example.com',
          'demo-club@example.com', true, v_owner)
  on conflict (slug) do nothing;

  select id into v_club from public.clubs where slug = 'demo-coding-club';
  select id into v_free from public.membership_plans where club_id = v_club and tier = 'free';

  insert into public.club_memberships (club_id, user_id, role, status, plan_id)
  values (v_club, v_owner, 'owner', 'active', v_free)
  on conflict (club_id, user_id) do nothing;

  if not exists (select 1 from public.events where club_id = v_club) then
    insert into public.events (club_id, title, description, venue, starts_at, ends_at, capacity, fee, status,
                               category, type, mode, registration_deadline, team_size, level, created_by)
    values
      (v_club, 'Intro to Git (free)', '[DEMO] Hands-on Git basics. Free for everyone.', 'Lab 1',
       now() + interval '7 days', now() + interval '7 days 2 hours', 60, 0, 'published',
       'Technical', 'workshop', 'offline', now() + interval '6 days', 'solo', 'beginner', v_owner),
      (v_club, 'Weekend Hackathon (paid)', '[DEMO] 24-hour build sprint. Test-mode payment required.', 'Main Hall',
       now() + interval '14 days', now() + interval '15 days', 100, 199, 'published',
       'Technical', 'hackathon', 'offline', now() + interval '12 days', 'solo', 'intermediate', v_owner),
      (v_club, 'Planning meetup (draft)', '[DEMO] Draft event visible only to club staff.', 'Room 204',
       now() + interval '21 days', null, null, 0, 'draft',
       'Technical', 'seminar', 'offline', null, 'solo', null, v_owner);
  end if;

  raise notice 'seed.sql: demo data ready for club demo-coding-club (owner %).', v_owner;
end $$;

-- Cleanup (uncomment to remove all demo data):
-- delete from public.clubs where slug like 'demo-%';
