-- OpenBox Ventures LLP panel - full schema. Run once on an empty project (or after reset.sql).
-- Auth: Clerk third-party auth. auth.jwt()->>'sub' = Clerk user id.
-- Role lives in Clerk publicMetadata.role, exposed in the session token as metadata.role
-- (Clerk → Sessions → Customize session token: {"metadata": "{{user.public_metadata}}"}).
-- Validation (geofence, leave rules) lives in SQL functions so it can't be bypassed via PostgREST.

create type attendance_mode as enum ('office', 'wfh');
create type leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type leave_accrual as enum ('yearly', 'monthly');
create type channel_type as enum ('dm', 'group', 'department');
create type issue_status as enum ('open', 'resolved');

-- ── Org ──────────────────────────────────────────────────────────────

create table offices (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  address     text,
  timezone    text not null default 'Asia/Kolkata',
  lat         double precision,
  lng         double precision,
  radius_m    int  not null default 200 check (radius_m > 0),
  work_start  time not null default '09:30',
  work_end    time not null default '18:30',
  grace_min   int  not null default 15 check (grace_min >= 0),
  work_days   int[] not null default '{1,2,3,4,5}', -- ISO weekday 1=Mon..7=Sun
  created_at  timestamptz not null default now()
);

create table departments (
  id         uuid primary key default gen_random_uuid(),
  office_id  uuid not null references offices on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (office_id, name)
);

-- Row created by admin at invite time; clerk_user_id linked on first sign-in.
-- Manager (Clerk role) manages everyone in their own office_id.
create table employees (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  email         text not null unique check (email = lower(email)),
  full_name     text not null,
  office_id     uuid references offices on delete set null,
  department_id uuid references departments on delete set null,
  designation   text,
  joined_on     date,
  active        boolean not null default true,
  -- copy of Clerk publicMetadata.role, kept in sync by the app; for filtering only (access uses the JWT)
  role          text check (role in ('employee', 'manager', 'admin')),
  avatar_url    text, -- copy of the Clerk profile photo (null = none), kept in sync by the app
  created_at    timestamptz not null default now()
);

-- ── Attendance ───────────────────────────────────────────────────────

create table attendance (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees on delete cascade,
  date          date not null,
  mode          attendance_mode not null,
  check_in_at   timestamptz not null default now(),
  check_out_at  timestamptz,
  check_in_lat  double precision,
  check_in_lng  double precision,
  note          text,
  unique (employee_id, date),
  check (check_out_at is null or check_out_at > check_in_at)
);

create table holidays (
  id        uuid primary key default gen_random_uuid(),
  office_id uuid references offices on delete cascade, -- null = all offices
  date      date not null,
  name      text not null
);

-- ── Leave ────────────────────────────────────────────────────────────

create table leave_types (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null unique,
  paid                    boolean not null default true,
  yearly_quota            numeric(5,1) not null default 0 check (yearly_quota >= 0),
  accrual                 leave_accrual not null default 'yearly',
  carry_forward_max       numeric(5,1) not null default 0 check (carry_forward_max >= 0),
  allow_half_day          boolean not null default true,
  doc_required_after_days int,
  active                  boolean not null default true
);

create table leave_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees on delete cascade,
  leave_type_id uuid not null references leave_types,
  start_date    date not null,
  end_date      date not null,
  half_day      boolean not null default false,
  days          numeric(5,1) not null check (days > 0),
  reason        text,
  doc_path      text,
  status        leave_status not null default 'pending',
  reviewed_by   uuid references employees,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now(),
  check (end_date >= start_date),
  check (not half_day or start_date = end_date)
);

create table leave_carry_forward (
  employee_id   uuid not null references employees on delete cascade,
  leave_type_id uuid not null references leave_types on delete cascade,
  year          int  not null,
  days          numeric(5,1) not null check (days >= 0),
  primary key (employee_id, leave_type_id, year)
);

-- ── Chat ─────────────────────────────────────────────────────────────

create table channels (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  type          channel_type not null,
  department_id uuid references departments on delete cascade,
  created_by    uuid references employees on delete set null,
  announcements boolean not null default false, -- the single company-wide Announcements channel
  created_at    timestamptz not null default now()
);
create unique index channels_announcements_key on channels (announcements) where announcements;

create table channel_members (
  channel_id   uuid not null references channels on delete cascade,
  employee_id  uuid not null references employees on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, employee_id)
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  channel_id      uuid not null references channels on delete cascade,
  sender_id       uuid references employees on delete set null,
  body            text,
  attachment_path text,
  created_at      timestamptz not null default now(),
  check (body is not null or attachment_path is not null)
);
create index on messages (channel_id, created_at desc);

-- "Report an issue": employees/managers → admins
create table issues (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees on delete cascade,
  subject     text not null check (length(subject) between 1 and 200),
  body        text not null,
  status      issue_status not null default 'open',
  admin_note  text,
  resolved_by uuid references employees on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on issues (status, created_at desc);

-- Personal details from the onboarding form. Separate table: employees is readable by
-- every colleague (directory), this one only by the person and admins.
create table employee_profiles (
  employee_id        uuid primary key references employees on delete cascade,
  date_of_birth      date not null check (date_of_birth < current_date),
  gender             text,
  phone              text not null,
  personal_email     text,
  blood_group        text,
  current_address    text not null,
  permanent_address  text,
  emergency_name     text not null,
  emergency_relation text not null,
  emergency_phone    text not null,
  completed_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter publication supabase_realtime add table messages;

-- ── RLS helpers (security definer: bypass RLS, avoid policy recursion) ──

-- role from Clerk publicMetadata; none = not assigned yet = no access
create function my_role() returns text
language sql stable as $$
  select auth.jwt()->'metadata'->>'role'
$$;

create function me() returns employees
language sql stable security definer set search_path = public as $$
  select * from employees
  where clerk_user_id = auth.jwt()->>'sub' and active
    and my_role() in ('employee', 'manager', 'admin')
$$;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'admin', false) and (select id from me()) is not null
$$;

create function manages(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from employees e, me() m
    where e.id = emp and my_role() = 'manager' and e.office_id = m.office_id and e.id <> m.id
  )
$$;

-- department channels: everyone in the department is a member implicitly
create function is_member(ch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from channel_members
                 where channel_id = ch and employee_id = (select id from me()))
      or exists (select 1 from channels c
                 where c.id = ch and c.type = 'department'
                   and c.department_id = (select department_id from me()))
      -- everyone reads the company Announcements channel
      or ((select id from me()) is not null and exists (select 1 from channels c where c.id = ch and c.announcements))
$$;

-- ── RLS ──────────────────────────────────────────────────────────────
-- Employees can't insert attendance/leave directly: check_in()/apply_leave() validate first.

alter table offices             enable row level security;
alter table departments         enable row level security;
alter table employees           enable row level security;
alter table attendance          enable row level security;
alter table holidays            enable row level security;
alter table leave_types         enable row level security;
alter table leave_requests      enable row level security;
alter table leave_carry_forward enable row level security;
alter table channels            enable row level security;
alter table channel_members     enable row level security;
alter table messages            enable row level security;
alter table issues              enable row level security;
alter table employee_profiles   enable row level security;

-- reference data: any active employee reads, admin writes
create policy read on offices     for select to authenticated using ((select id from me()) is not null);
create policy admin on offices    for all    to authenticated using (is_admin()) with check (is_admin());
create policy read on departments  for select to authenticated using ((select id from me()) is not null);
create policy admin on departments for all    to authenticated using (is_admin()) with check (is_admin());
create policy read on holidays     for select to authenticated using ((select id from me()) is not null);
create policy admin on holidays    for all    to authenticated using (is_admin()) with check (is_admin());
create policy read on leave_types  for select to authenticated using ((select id from me()) is not null);
create policy admin on leave_types for all    to authenticated using (is_admin()) with check (is_admin());

-- employees: directory visible to colleagues; admin manages
create policy read on employees  for select to authenticated using (active and (select id from me()) is not null or is_admin());
create policy admin on employees for all    to authenticated using (is_admin()) with check (is_admin());

-- attendance: own + managed; managers/admin fix entries
create policy read on attendance   for select to authenticated using (employee_id = (select id from me()) or manages(employee_id));
create policy fix on attendance    for update to authenticated using (manages(employee_id)) with check (manages(employee_id));
create policy remove on attendance for delete to authenticated using (manages(employee_id));

-- leave: own + managed read; inserts only via apply_leave(); managers/admin review
create policy read on leave_requests   for select to authenticated using (employee_id = (select id from me()) or manages(employee_id));
create policy review on leave_requests for update to authenticated using (manages(employee_id))
  with check (manages(employee_id) and status in ('approved', 'rejected') and reviewed_by = (select id from me()));

create policy read on leave_carry_forward  for select to authenticated using (employee_id = (select id from me()) or manages(employee_id));
create policy admin on leave_carry_forward for all    to authenticated using (is_admin()) with check (is_admin());

-- chat: members only
create policy read on channels   for select to authenticated using (is_member(id) or created_by = (select id from me()) or is_admin());
-- only plain groups; DMs via dm_with(), department/announcement channels by the system
create policy open on channels for insert to authenticated
  with check (created_by = (select id from me()) and type = 'group' and not announcements and department_id is null);
create policy read on channel_members for select to authenticated using (is_member(channel_id));
create policy add on channel_members  for insert to authenticated with check (
  (is_admin() or exists (select 1 from channels c where c.id = channel_id and c.type = 'group' and c.created_by = (select id from me())))
  and coalesce((select e.role from employees e where e.id = employee_id), '') <> 'admin' -- admins aren't chat members
);
create policy mark_read on channel_members for update to authenticated
  using (employee_id = (select id from me())) with check (employee_id = (select id from me()));
create policy read on messages for select to authenticated using (is_member(channel_id));
create policy send on messages for insert to authenticated with check (
  is_member(channel_id) and sender_id = (select id from me())
  and (attachment_path is null or attachment_path like (select id from me())::text || '/%') -- own uploads only
  and (is_admin() or my_role() = 'manager' or not exists (select 1 from channels c where c.id = channel_id and c.announcements)) -- admins + managers
);
create policy unpost on messages for delete to authenticated using ( -- admins: any announcement; managers: their own
  (is_admin() or sender_id = (select id from me())) and exists (select 1 from channels c where c.id = channel_id and c.announcements)
);

-- profiles: own + admins (writes go through the server, which handles not-yet-assigned users)
create policy read on employee_profiles for select to authenticated using (employee_id = (select id from me()) or is_admin());
create policy own on employee_profiles  for update to authenticated
  using (employee_id = (select id from me()) or is_admin()) with check (employee_id = (select id from me()) or is_admin());

-- issues: reporter sees own; admins see and resolve all
create policy read on issues    for select to authenticated using (employee_id = (select id from me()) or is_admin());
create policy report on issues  for insert to authenticated
  with check (employee_id = (select id from me()) and status = 'open' and resolved_by is null and admin_note is null);
create policy resolve on issues for update to authenticated using (is_admin()) with check (is_admin());


-- ════ Features: attendance, leave, chat logic ════
-- ── Attendance ───────────────────────────────────────────────────────

create function distance_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- today's date in the employee's office timezone
create function my_today() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce(
    (select o.timezone from offices o where o.id = (select office_id from me())), 'Asia/Kolkata'))::date
$$;

create function check_in(p_mode attendance_mode, p_lat float8 default null, p_lng float8 default null)
returns attendance language plpgsql security definer set search_path = public as $$
declare
  e employees := me();
  o offices;
  d float8;
  r attendance;
begin
  if e.id is null then raise exception 'Not an active employee'; end if;
  if my_role() = 'admin' then raise exception 'Admins don''t use attendance or leave'; end if;
  select * into o from offices where id = e.office_id;
  if p_mode = 'office' then
    if o.id is null then raise exception 'No office assigned to you'; end if;
    if o.lat is null or o.lng is null then raise exception 'Office location not set. Ask an admin.'; end if;
    if p_lat is null or p_lng is null then raise exception 'Location is required for office check-in'; end if;
    d := distance_m(p_lat, p_lng, o.lat, o.lng);
    if d > o.radius_m then
      raise exception 'You are % m from %, must be within % m', round(d), o.name, o.radius_m;
    end if;
  end if;
  insert into attendance (employee_id, date, mode, check_in_lat, check_in_lng)
  values (e.id, my_today(), p_mode, p_lat, p_lng)
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'Already checked in today';
end $$;

create function check_out() returns attendance
language plpgsql security definer set search_path = public as $$
declare r attendance;
begin
  update attendance set check_out_at = now()
  where employee_id = (select id from me()) and date = my_today() and check_out_at is null
  returning * into r;
  if r.id is null then raise exception 'No open check-in today'; end if;
  return r;
end $$;

create view attendance_report with (security_invoker = true) as
select a.*, e.full_name, e.email, e.office_id, e.department_id, o.name as office_name, o.timezone,
  (a.check_in_at at time zone o.timezone)::time > o.work_start + make_interval(mins => o.grace_min) as late,
  (a.check_out_at at time zone o.timezone)::time < o.work_end as early_leave,
  round(extract(epoch from a.check_out_at - a.check_in_at) / 3600.0, 2) as hours
from attendance a
join employees e on e.id = a.employee_id
left join offices o on o.id = e.office_id;

-- ── Leave ────────────────────────────────────────────────────────────

-- working days (office work_days minus holidays) in [s, e]
create function leave_days(emp uuid, s date, e date, half boolean) returns numeric
language sql stable security definer set search_path = public as $$
  select (case when half then 0.5 else 1 end) * count(*)
  from generate_series(s, e, interval '1 day') g(d)
  join employees em on em.id = emp
  left join offices o on o.id = em.office_id
  where extract(isodow from g.d)::int = any (coalesce(o.work_days, '{1,2,3,4,5}'))
    and not exists (select 1 from holidays h
                    where h.date = g.d::date and (h.office_id is null or h.office_id = em.office_id))
$$;

-- current-year balances for self (or managed employees)
-- ponytail: monthly accrual = quota/12 × current month, no pro-rata for mid-year joiners; add joined_on math if HR asks
create view leave_balances with (security_invoker = true) as
select *, entitled - used as balance from (
  select e.id as employee_id, t.id as leave_type_id, t.name, t.paid,
    (case t.accrual when 'yearly' then t.yearly_quota
       else round(t.yearly_quota * extract(month from current_date) / 12, 1) end)
      + coalesce(cf.days, 0) as entitled,
    coalesce(sum(r.days) filter (where r.status = 'approved'), 0) as used,
    coalesce(sum(r.days) filter (where r.status = 'pending'), 0) as pending
  from employees e
  cross join leave_types t
  left join leave_carry_forward cf
    on cf.employee_id = e.id and cf.leave_type_id = t.id and cf.year = extract(year from current_date)
  left join leave_requests r
    on r.employee_id = e.id and r.leave_type_id = t.id and extract(year from r.start_date) = extract(year from current_date)
  where t.active and e.active and (e.id = (select id from me()) or manages(e.id))
  group by e.id, t.id, cf.days
) b;

create function apply_leave(p_type uuid, p_start date, p_end date, p_half boolean,
                            p_reason text default null, p_doc text default null)
returns leave_requests language plpgsql security definer set search_path = public as $$
declare
  e employees := me();
  t leave_types;
  n numeric;
  avail numeric;
  r leave_requests;
begin
  if e.id is null then raise exception 'Not an active employee'; end if;
  if my_role() = 'admin' then raise exception 'Admins don''t use attendance or leave'; end if;
  select * into t from leave_types where id = p_type and active;
  if t.id is null then raise exception 'Invalid leave type'; end if;
  if p_end < p_start then raise exception 'End date is before start date'; end if;
  if extract(year from p_start) <> extract(year from p_end) then raise exception 'Split leave that crosses a year into two requests'; end if;
  if p_half and not t.allow_half_day then raise exception '% does not allow half days', t.name; end if;
  if p_half and p_start <> p_end then raise exception 'Half day must be a single date'; end if;

  n := leave_days(e.id, p_start, p_end, p_half);
  if n = 0 then raise exception 'No working days in that range'; end if;

  if exists (select 1 from leave_requests
             where employee_id = e.id and status in ('pending', 'approved')
               and start_date <= p_end and end_date >= p_start) then
    raise exception 'Overlaps an existing request';
  end if;

  if p_doc is not null and p_doc not like e.id::text || '/%' then raise exception 'Invalid document'; end if;
  if t.doc_required_after_days is not null and n > t.doc_required_after_days and p_doc is null then
    raise exception 'A document is required for % leave over % days', t.name, t.doc_required_after_days;
  end if;

  -- ponytail: balance enforced for current year only; next-year requests left to the reviewer
  if t.paid and extract(year from p_start) = extract(year from current_date) then
    select balance - pending into avail from leave_balances where employee_id = e.id and leave_type_id = t.id;
    if n > coalesce(avail, 0) then
      raise exception 'Not enough % balance: % available, % requested', t.name, coalesce(avail, 0), n;
    end if;
  end if;

  insert into leave_requests (employee_id, leave_type_id, start_date, end_date, half_day, days, reason, doc_path)
  values (e.id, t.id, p_start, p_end, p_half, n, p_reason, p_doc)
  returning * into r;
  return r;
end $$;

create function cancel_leave(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update leave_requests set status = 'cancelled'
  where id = p_id and employee_id = (select id from me()) and status = 'pending';
  if not found then raise exception 'Only your own pending requests can be cancelled'; end if;
end $$;

-- carry unused leave from year y into y+1, capped per type
create function close_year(y int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  insert into leave_carry_forward (employee_id, leave_type_id, year, days)
  select e.id, t.id, y + 1,
    least(t.carry_forward_max, greatest(0,
      t.yearly_quota + coalesce(cf.days, 0) - coalesce((
        select sum(r.days) from leave_requests r
        where r.employee_id = e.id and r.leave_type_id = t.id and r.status = 'approved'
          and extract(year from r.start_date) = y), 0)))
  from employees e
  cross join leave_types t
  left join leave_carry_forward cf on cf.employee_id = e.id and cf.leave_type_id = t.id and cf.year = y
  where e.active and t.active and t.carry_forward_max > 0
  on conflict (employee_id, leave_type_id, year) do update set days = excluded.days;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── Chat ─────────────────────────────────────────────────────────────

create function create_department_channel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into channels (name, type, department_id) values (new.name, 'department', new.id);
  return new;
end $$;

create trigger department_channel after insert on departments
for each row execute function create_department_channel();

-- department renamed → its channel follows (channels have no update policy)
create function rename_department_channel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update channels set name = new.name where department_id = new.id;
  return new;
end $$;

create trigger department_channel_rename after update of name on departments
for each row when (old.name is distinct from new.name) execute function rename_department_channel();

-- implicit members (department, announcements) store their read marker by joining once
create policy join_implicit on channel_members for insert to authenticated with check (
  employee_id = (select id from me()) and exists (
    select 1 from channels c where c.id = channel_id
      and (c.announcements or (c.type = 'department' and c.department_id = (select department_id from me()))))
);

-- find-or-create a DM with another employee
create function dm_with(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  my uuid := (select id from me());
  ch uuid;
begin
  if my is null then raise exception 'Not an active employee'; end if;
  if other = my then raise exception 'Cannot DM yourself'; end if;
  if not exists (select 1 from employees where id = other and active) then raise exception 'Unknown employee'; end if;
  if exists (select 1 from employees where id = other and role = 'admin') then
    raise exception 'Admins can''t be messaged directly. Use Report an issue instead.';
  end if;
  select a.channel_id into ch
  from channel_members a
  join channel_members b on b.channel_id = a.channel_id and b.employee_id = other
  join channels c on c.id = a.channel_id and c.type = 'dm'
  where a.employee_id = my
  limit 1;
  if ch is null then
    insert into channels (type, created_by) values ('dm', my) returning id into ch;
    insert into channel_members (channel_id, employee_id) values (ch, my), (ch, other);
  end if;
  return ch;
end $$;

create function my_channels()
returns table (id uuid, type channel_type, name text, unread bigint, last_at timestamptz, announcements boolean, avatar_url text)
language sql stable set search_path = public as $$
  select c.id, c.type,
    case when c.type = 'dm' then (
      select e.full_name from channel_members cm join employees e on e.id = cm.employee_id
      where cm.channel_id = c.id and cm.employee_id <> (select id from me()) limit 1)
    else c.name end,
    (select count(*) from messages m
     where m.channel_id = c.id and m.created_at > coalesce(mine.last_read_at, '-infinity')
       and m.sender_id is distinct from (select id from me())),
    (select max(m.created_at) from messages m where m.channel_id = c.id),
    c.announcements,
    case when c.type = 'dm' then (
      select e.avatar_url from channel_members cm join employees e on e.id = cm.employee_id
      where cm.channel_id = c.id and cm.employee_id <> (select id from me()) limit 1)
    end
  from channels c
  left join channel_members mine on mine.channel_id = c.id and mine.employee_id = (select id from me())
  where is_member(c.id)
  order by 6 desc, 5 desc nulls last, 3
$$;

-- ── Announcements channel: admins and managers post, automated posts from triggers, everyone reads ──

insert into channels (name, type, announcements) values ('Announcements', 'group', true);

-- system message (sender_id null) into the Announcements channel
create function post_announcement(body text) returns void
language sql security definer set search_path = public as $$
  insert into messages (channel_id, sender_id, body)
  select id, null, body from channels where announcements
$$;

create function announce_holiday() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform post_announcement(format('Holiday added: %s on %s%s', new.name, to_char(new.date, 'FMDay, FMDD Mon YYYY'),
    coalesce(' (' || (select name from offices where id = new.office_id) || ' office only)', '')));
  return new;
end $$;
create trigger announce_holiday after insert on holidays for each row execute function announce_holiday();

create function announce_office() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform post_announcement(format('New office: %s%s', new.name, coalesce(', ' || new.address, '')));
  return new;
end $$;
create trigger announce_office after insert on offices for each row execute function announce_office();

-- first role assigned to a recent joiner (joined_on is set on first sign-in) = welcome post.
-- The joined_on window keeps existing staff from being "welcomed" when their role copy first syncs.
create function announce_joiner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role is null and new.role in ('employee', 'manager') and new.joined_on >= current_date - 14 then
    perform post_announcement(format('Please welcome %s%s%s to OpenBox Ventures LLP!', new.full_name,
      coalesce(', ' || new.designation, ''),
      coalesce(' in ' || (select name from departments where id = new.department_id), '')));
  end if;
  return new;
end $$;
create trigger announce_joiner after update of role on employees for each row execute function announce_joiner();

-- ── Storage (private; files served via signed URLs after an RLS-checked lookup) ──

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    -- browser uploads directly via signed URL, so the bucket enforces the 10 MB cap
    insert into storage.buckets (id, name, public, file_size_limit) values
      ('leave-docs', 'leave-docs', false, 10485760),
      ('attachments', 'attachments', false, 10485760)
    on conflict (id) do update set file_size_limit = excluded.file_size_limit;
  end if;
end $$;

-- an owner's uploads never referenced by a message / leave request, older than a day (server-side sweep).
-- plpgsql: storage schema only exists on Supabase. ponytail: unindexed path lookups, fine at company scale.
create function orphan_uploads(owner uuid) returns table (bucket text, name text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select o.bucket_id::text, o.name::text from storage.objects o
    where o.bucket_id in ('attachments', 'leave-docs') and o.name like owner::text || '/%'
      and o.created_at < now() - interval '1 day'
      and not exists (select 1 from messages m where m.attachment_path = o.name)
      and not exists (select 1 from leave_requests l where l.doc_path = o.name);
end $$;

-- managers/admin can add a missed attendance entry
create policy add on attendance for insert to authenticated with check (manages(employee_id));

-- ── Privilege hardening (defence in depth on top of RLS) ──

-- system-only helper: never callable through the API
revoke execute on function post_announcement(text) from public, anon, authenticated;
revoke execute on function orphan_uploads(uuid) from public, anon, authenticated;

-- updates limited to the columns the app actually changes
revoke update on attendance, leave_requests, channel_members, messages from anon, authenticated;
grant update (mode, check_in_at, check_out_at, note) on attendance to authenticated;
grant update (status, reviewed_by, reviewed_at, review_note) on leave_requests to authenticated;
grant update (last_read_at) on channel_members to authenticated;

-- signed-out requests get nothing
revoke all on all tables in schema public from anon;
