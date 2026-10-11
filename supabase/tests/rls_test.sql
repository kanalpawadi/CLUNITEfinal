-- =============================================================================
-- RLS / permission tests. Runs inside ONE transaction and rolls back, so it is
-- safe to run in the Supabase SQL Editor on a real project (no data is kept).
-- Any failed expectation raises an exception: "Success. No rows returned" = all passed.
-- =============================================================================
begin;

-- Fixtures (as postgres) ------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local',   '{"full_name":"Olive Owner"}'),
  ('00000000-0000-0000-0000-00000000000b', 'member@test.local',  '{"full_name":"Max Member","gender":"female"}'),
  ('00000000-0000-0000-0000-00000000000c', 'outsider@test.local','{"full_name":"Oscar Outsider"}'),
  ('00000000-0000-0000-0000-00000000000d', 'treasurer@test.local','{"full_name":"Tess Treasurer"}'),
  ('00000000-0000-0000-0000-00000000000e', 'stranger@test.local', '{"full_name":"Sam Stranger"}');

do $$ begin
  if (select count(*) from public.users where email like '%@test.local') <> 5 then
    raise exception 'FAIL handle_new_user did not create public.users rows';
  end if;
  if (select gender from public.users where id = '00000000-0000-0000-0000-00000000000b') <> 'female' then
    raise exception 'FAIL handle_new_user did not copy gender';
  end if;
end $$;

insert into public.pending_clubs (id, official_email, pin, club_data, created_by)
values ('00000000-0000-0000-0000-0000000000f1', 'club@test.local', '12345678',
        '{"name":"RLS Test Club","category":"Technical"}', '00000000-0000-0000-0000-00000000000a');

-- Owner verifies the club ----------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
declare c public.clubs;
begin
  c := public.verify_and_create_club('00000000-0000-0000-0000-0000000000f1', '00000000');
  if c.id is not null then raise exception 'FAIL wrong PIN accepted'; end if;

  c := public.verify_and_create_club('00000000-0000-0000-0000-0000000000f1', '12345678');
  if c.slug <> 'rls-test-club' then raise exception 'FAIL slug was %', c.slug; end if;
  if (select count(*) from public.membership_plans where club_id = c.id) <> 4 then
    raise exception 'FAIL default plans not seeded';
  end if;
  if not exists (select 1 from public.club_memberships
                 where club_id = c.id and user_id = auth.uid() and role = 'owner' and status = 'active'
                   and member_code ~ '^CLB-[A-Z2-9]{6}$' and is_owner) then
    raise exception 'FAIL owner membership / member_code missing';
  end if;
  -- PIN must never be readable
  begin
    perform pin from public.pending_clubs;
    raise exception 'FAIL pin column readable';
  exception when insufficient_privilege then null; end;

  -- owner adds a treasurer
  perform public.add_club_staff(c.id, 'treasurer@test.local', 'treasurer');

  -- owner creates a free and a paid event, plus a draft
  insert into public.events (id, club_id, title, starts_at, fee, status, capacity)
  values ('00000000-0000-0000-0000-0000000000e1', c.id, 'Free talk', now() + interval '1 day', 0, 'published', 2),
         ('00000000-0000-0000-0000-0000000000e2', c.id, 'Paid workshop', now() + interval '2 days', 150, 'published', null),
         ('00000000-0000-0000-0000-0000000000e3', c.id, 'Secret draft', now() + interval '3 days', 0, 'draft', null);
end $$;

-- Member (B) ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$
declare
  v_club uuid := (select id from public.clubs where slug = 'rls-test-club');
  v_free uuid := (select id from public.membership_plans where club_id = (select id from public.clubs where slug = 'rls-test-club') and tier = 'free');
  v_std  uuid := (select id from public.membership_plans where club_id = (select id from public.clubs where slug = 'rls-test-club') and tier = 'standard');
  r public.event_registrations;
begin
  if (select count(*) from public.users) <> 1 then raise exception 'FAIL member can read other users'; end if;

  update public.users set full_name = 'Max M.' where id = auth.uid();
  begin
    update public.users set global_role = 'super_admin' where id = auth.uid();
    raise exception 'FAIL member could change global_role';
  exception when insufficient_privilege then null; end;

  -- cannot self-activate a paid plan
  begin
    insert into public.club_memberships (club_id, user_id, plan_id, status) values (v_club, auth.uid(), v_std, 'active');
    raise exception 'FAIL member self-activated a paid plan';
  exception when insufficient_privilege then null; end;

  -- can join on the free plan; role is forced to member
  insert into public.club_memberships (club_id, user_id, plan_id, status, role) values (v_club, auth.uid(), v_free, 'active', 'member');
  begin
    update public.club_memberships set role = 'admin' where user_id = auth.uid();
    raise exception 'FAIL member promoted themselves';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  -- sees only own membership row, no drafts, no ledger, no other payments
  if (select count(*) from public.club_memberships) <> 1 then raise exception 'FAIL member sees other memberships'; end if;
  if exists (select 1 from public.events where status = 'draft') then raise exception 'FAIL member sees drafts'; end if;
  if (select count(*) from public.event_expenses) <> 0 then raise exception 'FAIL member sees expenses'; end if;

  -- registers for the paid event; payment pending
  r := public.register_for_event('00000000-0000-0000-0000-0000000000e2');
  if r.payment_status <> 'created' then raise exception 'FAIL paid registration should start as created'; end if;
  r := public.register_for_event('00000000-0000-0000-0000-0000000000e1');
  if r.payment_status is not null then raise exception 'FAIL free registration should have null payment_status'; end if;

  begin
    update public.event_registrations set payment_status = 'paid' where user_id = auth.uid();
    raise exception 'FAIL member marked own registration paid';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.payments (user_id, event_id, razorpay_order_id, amount, purpose)
    values (auth.uid(), '00000000-0000-0000-0000-0000000000e2', 'order_fake', 1, 'event');
    raise exception 'FAIL member inserted a payment';
  exception when insufficient_privilege then null; end;

  begin
    perform public.finalize_payment('order_fake', 'pay_fake', true);
    raise exception 'FAIL member could call finalize_payment';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.attendance (event_id, user_id) values ('00000000-0000-0000-0000-0000000000e1', auth.uid());
    raise exception 'FAIL member checked themselves in';
  exception when insufficient_privilege then null; end;

  begin
    perform public.add_club_staff(v_club, 'outsider@test.local', 'admin');
    raise exception 'FAIL member could add staff';
  exception when insufficient_privilege then null; end;
end $$;

-- Outsider (C) ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.users) <> 1 then raise exception 'FAIL outsider can read other users'; end if;
  if (select count(*) from public.event_registrations) <> 0 then raise exception 'FAIL outsider sees registrations'; end if;
  if (select count(*) from public.club_memberships) <> 0 then raise exception 'FAIL outsider sees memberships'; end if;
  if (select count(*) from public.payments) <> 0 then raise exception 'FAIL outsider sees payments'; end if;
  if (select count(*) from public.events e join public.clubs c on c.id = e.club_id where c.slug = 'rls-test-club') <> 2 then raise exception 'FAIL outsider should see exactly 2 published events'; end if;
  -- capacity 2 on the free event: member used 1, outsider takes the 2nd seat, then it's full
  perform public.register_for_event('00000000-0000-0000-0000-0000000000e1');
  if (select current_participants from public.events where id = '00000000-0000-0000-0000-0000000000e1') <> 2 then
    raise exception 'FAIL current_participants not maintained';
  end if;
end $$;

-- Server (service role) finalises payments ------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  v_club uuid := (select id from public.clubs where slug = 'rls-test-club');
  v_std  uuid := (select id from public.membership_plans where club_id = (select id from public.clubs where slug = 'rls-test-club') and tier = 'standard');
  v_reg uuid := (select id from public.event_registrations where event_id = '00000000-0000-0000-0000-0000000000e2'
                 and user_id = '00000000-0000-0000-0000-00000000000b');
  p public.payments;
  v_exp timestamptz;
begin
  insert into public.payments (user_id, event_id, club_id, registration_id, razorpay_order_id, amount, purpose)
  values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000e2', v_club, v_reg, 'order_evt_1', 150, 'event');
  p := public.finalize_payment('order_evt_1', 'pay_1', true);
  p := public.finalize_payment('order_evt_1', 'pay_1', true); -- replay must be a no-op
  if p.status <> 'paid' or p.receipt_no is null then raise exception 'FAIL event payment not paid'; end if;
  if (select payment_status from public.event_registrations where id = v_reg) <> 'paid' then
    raise exception 'FAIL registration not marked paid';
  end if;
  if (select count(*) from public.event_expenses where payment_id = p.id and type = 'income' and amount = 150) <> 1 then
    raise exception 'FAIL income row missing or duplicated';
  end if;

  insert into public.payments (user_id, club_id, plan_id, razorpay_order_id, amount, purpose)
  values ('00000000-0000-0000-0000-00000000000b', v_club, v_std, 'order_mem_1', 299, 'membership');
  p := public.finalize_payment('order_mem_1', 'pay_2', true);
  select expires_at into v_exp from public.club_memberships
   where club_id = v_club and user_id = '00000000-0000-0000-0000-00000000000b' and status = 'active' and plan_id = v_std;
  if v_exp is null or abs(extract(epoch from (v_exp - (now() + interval '180 days')))) > 60 then
    raise exception 'FAIL membership expiry wrong: %', v_exp;
  end if;
  -- renewal extends from the current expiry
  insert into public.payments (user_id, club_id, plan_id, razorpay_order_id, amount, purpose)
  values ('00000000-0000-0000-0000-00000000000b', v_club, v_std, 'order_mem_2', 299, 'membership');
  p := public.finalize_payment('order_mem_2', 'pay_3', true);
  if abs(extract(epoch from ((select expires_at from public.club_memberships where id = p.membership_id)
                             - (now() + interval '360 days')))) > 60 then
    raise exception 'FAIL renewal did not extend expiry';
  end if;
end $$;

-- Owner (A) and treasurer (D) see club data -------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from public.users where id = '00000000-0000-0000-0000-00000000000b') then
    raise exception 'FAIL owner cannot see member profile';
  end if;
  if exists (select 1 from public.users where id = '00000000-0000-0000-0000-00000000000e') then
    raise exception 'FAIL owner can read an unrelated user';
  end if;
  if (select count(*) from public.event_registrations) < 2 then raise exception 'FAIL owner cannot see registrations'; end if;
  if (select count(*) from public.payments) <> 3 then raise exception 'FAIL owner cannot see club payments'; end if;
  insert into public.attendance (event_id, user_id, checked_in_by)
  values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000b', auth.uid());
  begin
    insert into public.attendance (event_id, user_id) values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000b');
    raise exception 'FAIL duplicate check-in allowed';
  exception when unique_violation then null; end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.event_expenses) <> 1 then raise exception 'FAIL treasurer cannot read ledger'; end if;
  insert into public.event_expenses (event_id, category, amount) values ('00000000-0000-0000-0000-0000000000e2', 'Snacks', 20);
  if exists (select 1 from public.users where id = '00000000-0000-0000-0000-00000000000e') then
    raise exception 'FAIL treasurer can read unrelated user';
  end if;
end $$;

-- Anonymous visitor -----------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  if (select count(*) from public.events e join public.clubs c on c.id = e.club_id where c.slug = 'rls-test-club') <> 2 then raise exception 'FAIL anon should see published events only'; end if;
  begin
    perform 1 from public.users;
    raise exception 'FAIL anon can query users';
  exception when insufficient_privilege then null; end;
  begin
    perform public.register_for_event('00000000-0000-0000-0000-0000000000e2');
    raise exception 'FAIL anon can register';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
rollback;
