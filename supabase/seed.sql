-- =============================================================================
-- OPTIONAL DEMO DATA. Do NOT run in production.
-- =============================================================================
-- Run AFTER schema.sql and AFTER at least one account has signed up.
-- Creates 10 demo clubs (slug "demo-*", descriptions tagged "[DEMO]") owned by the account
-- in v_owner_email (or the earliest account), each with:
--   * the 4 default plans (Free / Standard / Premium / Lifetime, added by a trigger)
--   * a faculty coordinator and HOD (printed on certificates)
--   * 3 events: one happening TODAY (for testing the QR scanner), one upcoming
--     (paid for half the clubs, to test payments), and one in the past
-- The owner is also registered for and checked in to the first club's past event, so
-- they get one real, verifiable certificate on /dashboard/student/certificates.
-- Safe to run more than once.
-- =============================================================================

do $$
declare
  v_owner_email constant text := 'you@example.com'; -- change me (optional)
  v_owner uuid;
  v_club uuid;
  v_free uuid;
  v_past uuid;
  v_first_past uuid;
  c record;
  i int := 0;
begin
  select id into v_owner from public.users where lower(email) = lower(v_owner_email);
  if v_owner is null then
    select id into v_owner from public.users order by created_at limit 1;
  end if;
  if v_owner is null then
    raise notice 'seed.sql: no users yet. Sign up once, then re-run this file.';
    return;
  end if;

  for c in
    select * from (values
      ('Demo Coding Club',        'demo-coding-club',      'Technical',        'Build. Ship. Repeat.',              'Dr. Anita Rao',       'Dr. Vikram Mehta',   'Computer Science'),
      ('Demo Robotics Society',   'demo-robotics',         'Technical',        'Robots, sensors and late nights.',  'Prof. Suresh Iyer',   'Dr. Kavita Nair',    'Mechatronics'),
      ('Demo AI & Data Lab',      'demo-ai-data',          'Technical',        'Learning machines, together.',      'Dr. Meera Krishnan',  'Dr. Vikram Mehta',   'Data Science'),
      ('Demo Music Collective',   'demo-music',            'Music',            'Every genre, one stage.',           'Prof. Rohan Das',     'Dr. Sunita Joshi',   'Fine Arts'),
      ('Demo Dance Crew',         'demo-dance',            'Dance',            'Move like nobody is watching.',     'Prof. Neha Kapoor',   'Dr. Sunita Joshi',   'Performing Arts'),
      ('Demo Drama Circle',       'demo-drama',            'Drama',            'All the campus is a stage.',        'Prof. Arjun Menon',   'Dr. Sunita Joshi',   'Performing Arts'),
      ('Demo Photography Club',   'demo-photography',      'Photography',      'Light, frame, story.',              'Prof. Farah Khan',    'Dr. Rajesh Gupta',   'Media Studies'),
      ('Demo Literary Society',   'demo-literary',         'Literary',         'Read more. Write more.',            'Dr. Lakshmi Pillai',  'Dr. Rajesh Gupta',   'English'),
      ('Demo E-Cell',             'demo-ecell',            'Entrepreneurship', 'From idea to first customer.',      'Prof. Karan Shah',    'Dr. Priya Sharma',   'Management'),
      ('Demo Social Impact Club', 'demo-social-impact',    'Social Service',   'Small acts, real change.',          'Dr. Imran Qureshi',   'Dr. Priya Sharma',   'Social Sciences')
    ) as t(name, slug, category, tagline, faculty, hod, dept)
  loop
    i := i + 1;

    insert into public.clubs (name, slug, description, tagline, category, college, official_email, contact_email,
                              faculty_in_charge, hod_name, is_verified, created_by)
    values (c.name, c.slug,
            format('[DEMO] %s club of the %s department. Sample data for exploring Clunite.', c.category, c.dept),
            c.tagline, c.category, 'Demo Institute of Technology',
            replace(c.slug, 'demo-', '') || '@demo.clunite.test', replace(c.slug, 'demo-', '') || '@demo.clunite.test',
            c.faculty, c.hod, true, v_owner)
    on conflict (slug) do update
      set faculty_in_charge = coalesce(public.clubs.faculty_in_charge, excluded.faculty_in_charge),
          hod_name = coalesce(public.clubs.hod_name, excluded.hod_name);

    select id into v_club from public.clubs where slug = c.slug;
    select id into v_free from public.membership_plans where club_id = v_club and tier = 'free';

    insert into public.club_memberships (club_id, user_id, role, status, plan_id)
    values (v_club, v_owner, 'owner', 'active', v_free)
    on conflict (club_id, user_id) do nothing;

    if not exists (select 1 from public.events where club_id = v_club) then
      insert into public.events (club_id, title, description, venue, starts_at, ends_at, capacity, fee, status,
                                 category, type, mode, registration_deadline, team_size, level, created_by)
      values
        (v_club, c.name || ': Open Day', '[DEMO] Meet the team and see what we do. Happening today, so it shows up in the scanner.',
         'Seminar Hall ' || i, date_trunc('hour', now()) + interval '1 hour', date_trunc('hour', now()) + interval '4 hours',
         80, 0, 'published', c.category, 'seminar', 'offline', date_trunc('hour', now()) + interval '50 minutes', 'solo', 'beginner', v_owner),
        (v_club, c.name || ': Workshop', '[DEMO] Hands-on session for members and newcomers.',
         'Lab ' || i, now() + make_interval(days => 5 + i), now() + make_interval(days => 5 + i, hours => 3),
         40, case when i % 2 = 0 then 149 else 0 end, 'published', c.category, 'workshop', 'offline',
         now() + make_interval(days => 4 + i), 'solo', 'intermediate', v_owner),
        (v_club, c.name || ': Annual Meetup', '[DEMO] Last month''s meetup (completed). Attendees receive a certificate.',
         'Auditorium', now() - make_interval(days => 20 + i), now() - make_interval(days => 20 + i) + interval '3 hours',
         120, 0, 'completed', c.category, 'conference', 'offline', null, 'solo', null, v_owner);
    end if;

    if i = 1 then
      select id into v_first_past from public.events
       where club_id = v_club and status = 'completed' order by starts_at limit 1;
    end if;
  end loop;

  -- One attended past event -> one real certificate for the owner
  if v_first_past is not null then
    insert into public.event_registrations (event_id, user_id, status, registration_data, participant_count)
    values (v_first_past, v_owner, 'registered', '{"registration_type":"solo"}', 1)
    on conflict (event_id, user_id) do nothing;
    insert into public.attendance (event_id, user_id, checked_in_at, checked_in_by)
    select v_first_past, v_owner, e.starts_at + interval '10 minutes', v_owner from public.events e where e.id = v_first_past
    on conflict (event_id, user_id) do nothing;
  end if;

  raise notice 'seed.sql: 10 demo clubs ready (owner %).', v_owner;
end $$;

-- Cleanup (uncomment to remove all demo data; cascades to plans, events, registrations, attendance):
-- delete from public.clubs where slug like 'demo-%';
