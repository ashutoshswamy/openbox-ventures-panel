-- Open Box Ventures LLP panel - full schema. Run once on an empty project (or after reset.sql).
-- Auth: Clerk third-party auth. auth.jwt()->>'sub' = Clerk user id.
-- Role lives in Clerk publicMetadata.role, exposed in the session token as metadata.role
-- (Clerk → Sessions → Customize session token: {"metadata": "{{user.public_metadata}}"}).
-- Validation (geofence, leave rules) lives in SQL functions so it can't be bypassed via PostgREST.
-- Roles: employee, manager (office head), hr (office-scoped), admin (whole org).

create type attendance_mode as enum ('office', 'wfh');
create type leave_status as enum ('pending', 'manager_approved', 'approved', 'rejected', 'cancelled');
create type leave_accrual as enum ('yearly', 'monthly');
create type channel_type as enum ('dm', 'group', 'department', 'office', 'global'); -- office: one per office; global: company-wide General
create type issue_status as enum ('open', 'resolved');
create type payroll_status as enum ('draft', 'submitted', 'approved');

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
-- Manager / HR (Clerk role) manage everyone in their own office_id.
-- email = company email (login + invite).
create table employees (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  email         text not null unique check (email = lower(email)),
  full_name     text not null check (length(full_name) between 1 and 120),
  office_id     uuid references offices on delete set null,
  department_id uuid references departments on delete set null,
  designation   text,
  joined_on     date,
  exit_date     date check (exit_date >= joined_on),
  employee_code text unique check (employee_code = trim(employee_code) and employee_code <> ''), -- auto OBV001, OBV002… (default below)
  alias_name    text check (length(alias_name) <= 60), -- set by the employee on their profile
  reports_to    uuid references employees on delete set null check (reports_to <> id), -- org chart
  active        boolean not null default true,
  -- copy of Clerk publicMetadata.role, kept in sync by the app; for filtering only (access uses the JWT)
  role          text check (role in ('employee', 'manager', 'hr', 'admin')),
  avatar_url    text, -- copy of the Clerk profile photo (null = none), kept in sync by the app
  created_at    timestamptz not null default now()
);

-- Next code = highest OBVnnn + 1, so failed inserts leave no gaps (a sequence would).
-- ponytail: two invites in the same instant can race to one code; the unique index rejects the second, re-send it.
create function next_employee_code() returns text
language sql volatile set search_path = public as $$
  select 'OBV' || lpad(n::text, greatest(3, length(n::text)), '0')
  from (select coalesce(max(substring(employee_code from 4)::int), 0) + 1 as n
        from employees where employee_code ~ '^OBV[0-9]+$') s
$$;
alter table employees alter column employee_code set default next_employee_code();

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

-- Attendance regularization: employee asks to fix a missed / wrong check-in for a past day.
-- Max 5 per calendar month (pending + approved). HR (own office) or admin approves → attendance row upserted.
create table regularizations (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees on delete cascade,
  date         date not null,
  mode         attendance_mode not null,
  check_in_at  timestamptz not null,
  check_out_at timestamptz not null,
  reason       text not null check (length(reason) between 1 and 500),
  status       leave_status not null default 'pending',
  reviewed_by  uuid references employees,
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz not null default now(),
  check (check_out_at > check_in_at)
);
-- one open/approved request per day
create unique index on regularizations (employee_id, date) where status in ('pending', 'approved');

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
  reason        text check (length(reason) <= 500),
  doc_path      text,
  status        leave_status not null default 'pending',
  manager_reviewed_by uuid references employees, -- step 1 (manager), then reviewed_by = final (HR / admin)
  manager_reviewed_at timestamptz,
  manager_note        text,
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
  name          text check (length(name) <= 100),
  type          channel_type not null,
  department_id uuid references departments on delete cascade,
  office_id     uuid references offices on delete cascade, -- type = 'office'
  created_by    uuid references employees on delete set null,
  announcements boolean not null default false, -- the single company-wide Announcements channel
  created_at    timestamptz not null default now()
);
create unique index channels_announcements_key on channels (announcements) where announcements;
create unique index channels_office_key on channels (office_id) where type = 'office';
create unique index channels_global_key on channels (type) where type = 'global';

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
  body            text check (length(body) <= 5000),
  attachment_path text,
  created_at      timestamptz not null default now(),
  check (body is not null or attachment_path is not null)
);
create index on messages (channel_id, created_at desc);

-- Video calls (one Jitsi room per call) for the call history. Written only by start_call / call_ping / end_call.
-- A call is over at ended_at ("End call") or, failing that, once nobody has pinged for a minute.
create table calls (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels on delete cascade,
  room       text not null unique check (room ~ '^[a-f0-9]{12}$'),
  started_by uuid references employees on delete set null,
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);
create index on calls (channel_id, started_at desc);

-- one row per person per call: first join → last heartbeat (sent while their Jitsi tab is open)
create table call_participants (
  call_id      uuid not null references calls on delete cascade,
  employee_id  uuid not null references employees on delete cascade,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (call_id, employee_id)
);

-- "Report an issue": employees/managers → admins
create table issues (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees on delete cascade,
  subject     text not null check (length(subject) between 1 and 200),
  body        text not null check (length(body) between 1 and 5000),
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
  updated_at         timestamptz not null default now(),
  -- free text from the onboarding form: keep it bounded
  check (length(current_address) <= 500 and length(coalesce(permanent_address, '')) <= 500
    and length(emergency_name) <= 120 and length(emergency_relation) <= 60 and length(coalesce(personal_email, '')) <= 254
    and length(coalesce(gender, '')) <= 30 and length(coalesce(blood_group, '')) <= 10)
);

-- ── To-dos ───────────────────────────────────────────────────────────

-- To-dos: everyone keeps a personal list; admins (anyone) and managers (own office) assign tasks.
create table todos (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references employees on delete cascade,  -- whose list it's on
  assigned_by uuid references employees on delete set null,          -- null = personal
  title       text not null check (length(title) between 1 and 300),
  due_on      date,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on todos (owner_id, done_at);
create index on todos (assigned_by) where assigned_by is not null;

-- ── Payroll (India) ──────────────────────────────────────────────────
-- Salary data readable by the employee, admin and HR of the employee's office only (managers: no).
-- All writes go through security definer functions (payroll section below).

-- ── Salary revisions (increment = new row) ──
create table employee_salaries (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references employees on delete cascade,
  annual_ctc     numeric(12,2) not null check (annual_ctc > 0),
  effective_from date not null,
  note           text,
  created_by     uuid references employees,
  created_at     timestamptz not null default now(),
  unique (employee_id, effective_from)
);

-- ── Bank / statutory details ──
create table employee_bank (
  employee_id    uuid primary key references employees on delete cascade,
  holder_name    text not null check (trim(holder_name) <> ''),
  account_number text not null check (account_number ~ '^[0-9]{6,20}$'),
  ifsc           text not null check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name      text not null check (trim(bank_name) <> ''),
  pan            text check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  uan            text check (uan ~ '^[0-9]{12}$'),
  updated_at     timestamptz not null default now()
);

-- ── Salary sheets ──
create table payroll_runs (
  id           uuid primary key default gen_random_uuid(),
  month        date not null check (month = date_trunc('month', month)::date), -- first of month
  office_id    uuid references offices on delete cascade, -- null = whole org (admin only)
  status       payroll_status not null default 'draft',
  created_by   uuid references employees,
  created_at   timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_by  uuid references employees,
  reviewed_at  timestamptz,
  review_note  text -- set when admin sends it back to draft
);
create unique index on payroll_runs (month, coalesce(office_id, '00000000-0000-0000-0000-000000000000'));

create table payroll_lines (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null references payroll_runs on delete cascade,
  employee_id      uuid not null references employees on delete cascade,
  basic            numeric(12,2) not null,
  hra              numeric(12,2) not null,
  special          numeric(12,2) not null,
  gross            numeric(12,2) not null,
  employee_pf      numeric(12,2) not null default 0,
  employer_pf      numeric(12,2) not null default 0,
  employee_esi     numeric(12,2) not null default 0,
  employer_esi     numeric(12,2) not null default 0,
  pt               numeric(12,2) not null default 0,
  tds              numeric(12,2) not null default 0 check (tds >= 0),
  other_deductions numeric(12,2) not null default 0 check (other_deductions >= 0),
  lop_days         numeric(4,1) not null default 0 check (lop_days >= 0),
  lop_amount       numeric(12,2) not null default 0,
  net              numeric(12,2) not null,
  unique (run_id, employee_id)
);

-- one reminder per (day, kind, ref), so re-running the same day is harmless
create table reminder_log (
  day  date not null,
  kind text not null,
  ref  text not null,
  primary key (day, kind, ref)
);

-- per-user request counter for server actions / file routes (fixed window). Server key only.
create table rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  hits         int not null
);

-- live refresh (components/live-refresh.tsx) + chat. Not channel_members: opening a chat writes last_read_at → refresh loop.
alter publication supabase_realtime add table messages, leave_requests, attendance, issues, holidays, employees, todos, regularizations;

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
    and my_role() in ('employee', 'manager', 'hr', 'admin')
$$;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'admin', false) and (select id from me()) is not null
$$;

create function manages(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from employees e, me() m
    where e.id = emp and my_role() in ('manager', 'hr') and e.office_id = m.office_id and e.id <> m.id
  )
$$;

-- payroll access: own pay, admin, HR of the employee's office
create function can_see_pay(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select emp = (select id from me()) or is_admin() or (my_role() = 'hr' and manages(emp))
$$;

-- caller may run payroll for this office (null = whole org: admin only)
create function can_run_payroll(p_office uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or (my_role() = 'hr' and p_office is not null and p_office = (select office_id from me()))
$$;

-- implicit members: department / office channels (own one), global + announcements (any active employee)
create function is_member(ch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from channel_members
                 where channel_id = ch and employee_id = (select id from me()))
      or exists (select 1 from channels c
                 where c.id = ch and c.type = 'department'
                   and c.department_id = (select department_id from me()))
      or exists (select 1 from channels c
                 where c.id = ch and c.type = 'office'
                   and c.office_id = (select office_id from me()))
      or ((select id from me()) is not null and exists (select 1 from channels c where c.id = ch and (c.announcements or c.type = 'global')))
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
alter table calls               enable row level security;
alter table call_participants   enable row level security;
alter table issues              enable row level security;
alter table employee_profiles   enable row level security;
alter table todos               enable row level security;
alter table regularizations     enable row level security;
alter table employee_salaries   enable row level security;
alter table employee_bank       enable row level security;
alter table payroll_runs        enable row level security;
alter table payroll_lines       enable row level security;
alter table reminder_log        enable row level security; -- server only (no policies)
alter table rate_limits         enable row level security; -- server only (no policies)

-- reference data: any active employee reads, admin writes
create policy read on offices     for select to authenticated using ((select id from me()) is not null);
create policy admin on offices    for all    to authenticated using (is_admin()) with check (is_admin());
create policy read on departments  for select to authenticated using ((select id from me()) is not null);
create policy admin on departments for all    to authenticated using (is_admin()) with check (is_admin());
create policy read on holidays     for select to authenticated using ((select id from me()) is not null);
create policy admin on holidays    for all    to authenticated using (is_admin()) with check (is_admin());
create policy read on leave_types  for select to authenticated using ((select id from me()) is not null);
create policy admin on leave_types for all    to authenticated using (is_admin()) with check (is_admin());

-- employees: directory visible to colleagues; managers/HR also see deactivated rows of their office; admin manages.
-- Admin rows are invisible to everyone else (joins to them come back null), so admins stay anonymous in the panel.
create policy read on employees  for select to authenticated using (
  role is distinct from 'admin' and ((active and (select id from me()) is not null) or manages(id))
);
create policy admin on employees for all    to authenticated using (is_admin()) with check (is_admin());

-- attendance: own + managed; managers/admin fix entries
create policy read on attendance   for select to authenticated using (employee_id = (select id from me()) or manages(employee_id));
create policy fix on attendance    for update to authenticated using (manages(employee_id)) with check (manages(employee_id));
create policy remove on attendance for delete to authenticated using (manages(employee_id));

-- leave: own + managed read; writes only via apply_leave() / review_leave() / cancel_leave()
create policy read on leave_requests   for select to authenticated using (employee_id = (select id from me()) or manages(employee_id));

-- regularizations: own + managed read; writes only via request_/review_regularization()
create policy read on regularizations for select to authenticated
  using (employee_id = (select id from me()) or manages(employee_id));

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
  and exists (select 1 from employees e where e.id = employee_id and e.role is distinct from 'admin') -- admins aren't chat members (and are invisible to non-admins)
);
-- admin-made group chats: admins see/remove members, rename, delete (plain groups only; admins aren't members)
create policy admin_read on channel_members for select to authenticated
  using (is_admin() and exists (select 1 from channels c where c.id = channel_id and c.type = 'group' and not c.announcements));
create policy admin_remove on channel_members for delete to authenticated
  using (is_admin() and exists (select 1 from channels c where c.id = channel_id and c.type = 'group' and not c.announcements));
create policy admin_rename on channels for update to authenticated
  using (is_admin() and type = 'group' and not announcements)
  with check (type = 'group' and not announcements and department_id is null and office_id is null);
create policy admin_delete on channels for delete to authenticated
  using (is_admin() and type = 'group' and not announcements);
create policy mark_read on channel_members for update to authenticated
  using (employee_id = (select id from me())) with check (employee_id = (select id from me()));
create policy read on messages for select to authenticated using (is_member(channel_id));
create policy read on calls for select to authenticated using (is_member(channel_id));
create policy read on call_participants for select to authenticated
  using (exists (select 1 from calls c where c.id = call_id and is_member(c.channel_id)));
create policy send on messages for insert to authenticated with check (
  is_member(channel_id) and sender_id = (select id from me())
  and (attachment_path is null or attachment_path like (select id from me())::text || '/%') -- own uploads only
  and (is_admin() or my_role() in ('manager', 'hr') or not exists (select 1 from channels c where c.id = channel_id and c.announcements)) -- admins + managers + HR
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

-- to-dos: owner sees their list; assigner tracks what they handed out
create policy read on todos for select to authenticated
  using (owner_id = (select id from me()) or assigned_by = (select id from me()));
create policy add on todos for insert to authenticated with check (
  (owner_id = (select id from me()) and assigned_by is null)
  or (assigned_by = (select id from me()) and manages(owner_id))
);
create policy edit on todos for update to authenticated
  using (owner_id = (select id from me()) or assigned_by = (select id from me()))
  with check (owner_id = (select id from me()) or assigned_by = (select id from me()));
-- assignee can't drop an assigned task, only finish it
create policy remove on todos for delete to authenticated
  using ((owner_id = (select id from me()) and assigned_by is null) or assigned_by = (select id from me()));

-- payroll: salary/bank readable by can_see_pay(); sheets by admin + HR of the office
create policy read on employee_salaries for select to authenticated using (can_see_pay(employee_id));
create policy read on employee_bank     for select to authenticated using (can_see_pay(employee_id));
create policy read on payroll_runs for select to authenticated
  using (is_admin() or (my_role() = 'hr' and office_id = (select office_id from me())));
create policy read on payroll_lines for select to authenticated
  using (is_admin() or (my_role() = 'hr' and manages(employee_id)));


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

-- Regularization: fix a missed / wrong check-in for a past day. Max 5 per calendar month (pending + approved).
-- HR (own office) or admin approves → attendance row upserted.
create function request_regularization(p_date date, p_mode attendance_mode, p_in time, p_out time, p_reason text)
returns regularizations language plpgsql security definer set search_path = public as $$
declare
  e employees := me();
  tz text;
  r regularizations;
begin
  if e.id is null then raise exception 'Not an active employee'; end if;
  if my_role() = 'admin' then raise exception 'Admins don''t use attendance or leave'; end if;
  if p_date > my_today() then raise exception 'Can''t regularize a future date'; end if;
  if p_out <= p_in then raise exception 'Check-out must be after check-in'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Reason is required'; end if;
  perform 1 from employees where id = e.id for update; -- serialize the monthly count
  if (select count(*) from regularizations
      where employee_id = e.id and status in ('pending', 'approved')
        and date_trunc('month', date) = date_trunc('month', p_date)) >= 5 then
    raise exception 'Regularization limit reached: 5 per month';
  end if;
  tz := coalesce((select timezone from offices where id = e.office_id), 'Asia/Kolkata');
  insert into regularizations (employee_id, date, mode, check_in_at, check_out_at, reason)
  values (e.id, p_date, p_mode, (p_date + p_in) at time zone tz, (p_date + p_out) at time zone tz, trim(p_reason))
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'You already have a regularization for that day';
end $$;

create function review_regularization(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r regularizations;
begin
  select * into r from regularizations where id = p_id and status = 'pending' for update;
  if r.id is null then raise exception 'Request not found or already reviewed'; end if;
  -- HR approves (own office, not self, via manages()); admin as fallback
  if not (is_admin() or (my_role() = 'hr' and manages(r.employee_id))) then
    raise exception 'Only HR can review regularizations';
  end if;
  update regularizations
  set status = case when p_approve then 'approved' else 'rejected' end::leave_status,
      reviewed_by = (select id from me()), reviewed_at = now(), review_note = p_note
  where id = r.id;
  if p_approve then
    insert into attendance (employee_id, date, mode, check_in_at, check_out_at, note)
    values (r.employee_id, r.date, r.mode, r.check_in_at, r.check_out_at, 'Regularized: ' || r.reason)
    on conflict (employee_id, date) do update
      set mode = excluded.mode, check_in_at = excluded.check_in_at, check_out_at = excluded.check_out_at, note = excluded.note;
  end if;
end $$;

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
    coalesce(sum(r.days) filter (where r.status::text in ('pending', 'manager_approved')), 0) as pending
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
             where employee_id = e.id and status in ('pending', 'manager_approved', 'approved')
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

-- Add / replace the supporting document on your own open or approved leave (e.g. HR asks for a medical certificate).
-- Replaced file is no longer referenced → swept by orphan_uploads().
create function update_leave_doc(p_id uuid, p_doc text) returns void
language plpgsql security definer set search_path = public as $$
declare e employees := me();
begin
  if p_doc is null or p_doc not like e.id::text || '/%' then raise exception 'Invalid document'; end if;
  update leave_requests set doc_path = p_doc
  where id = p_id and employee_id = e.id and status in ('pending', 'manager_approved', 'approved');
  if not found then raise exception 'Only your own pending or approved requests can be updated'; end if;
end $$;

-- Two-step approval: manager → 'manager_approved' → HR (or admin) final 'approved'.
-- Manager approves/rejects first; HR (own office) or admin gives the final decision.
-- HR/admin may decide straight from 'pending' only if admin, the employee is a manager, or the office has no manager.
-- Manager/HR leave: manager can't review it (HR leave: admin only).
create function review_leave(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r leave_requests;
  emp employees;
  rl text := my_role();
  who uuid := (select id from me());
  skip boolean;
begin
  select * into r from leave_requests where id = p_id and status in ('pending', 'manager_approved') for update;
  if r.id is null then raise exception 'Request not found or already reviewed'; end if;
  if r.employee_id = who or not manages(r.employee_id) then raise exception 'Not allowed to review this request'; end if;
  select * into emp from employees where id = r.employee_id;
  skip := is_admin() or emp.role = 'manager'
    or not exists (select 1 from employees m where m.office_id = emp.office_id and m.role = 'manager' and m.active and m.id <> emp.id);

  if rl = 'manager' then
    if emp.role in ('manager', 'hr') then raise exception 'Only HR can give final approval'; end if;
    if r.status = 'manager_approved' then raise exception 'Only HR can give final approval'; end if;
    update leave_requests set
      status = case when p_approve then 'manager_approved' else 'rejected' end::leave_status,
      manager_reviewed_by = who, manager_reviewed_at = now(), manager_note = p_note,
      reviewed_by = case when p_approve then null else who end,
      reviewed_at = case when p_approve then null else now() end,
      review_note = case when p_approve then null else p_note end
    where id = r.id;
  else
    if emp.role = 'hr' and not is_admin() then raise exception 'Only admin can review HR leave'; end if;
    if r.status = 'pending' and not skip then raise exception 'Waiting for manager approval'; end if;
    update leave_requests set
      status = case when p_approve then 'approved' else 'rejected' end::leave_status,
      reviewed_by = who, reviewed_at = now(), review_note = p_note
    where id = r.id;
  end if;
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

-- ── Org chart ────────────────────────────────────────────────────────

-- reject a reports_to that would close a loop (walk up the chain; reaching the row itself = cycle)
create function employees_no_cycle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reports_to is not null and exists (
    with recursive up as (
      select id, reports_to from employees where id = new.reports_to
      union
      select e.id, e.reports_to from employees e join up on e.id = up.reports_to
    ) select 1 from up where id = new.id
  ) then raise exception 'Reporting line would form a cycle'; end if;
  return new;
end $$;
create trigger employees_no_cycle before insert or update of reports_to on employees
  for each row execute function employees_no_cycle();

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

-- same for offices
create function create_office_channel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into channels (name, type, office_id) values (new.name, 'office', new.id);
  return new;
end $$;

create trigger office_channel after insert on offices
for each row execute function create_office_channel();

create function rename_office_channel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update channels set name = new.name where type = 'office' and office_id = new.id;
  return new;
end $$;

create trigger office_channel_rename after update of name on offices
for each row when (old.name is distinct from new.name) execute function rename_office_channel();

-- implicit members (department, office, global, announcements) store their read marker by joining once
create policy join_implicit on channel_members for insert to authenticated with check (
  employee_id = (select id from me()) and exists (
    select 1 from channels c where c.id = channel_id
      and (c.announcements or c.type = 'global'
        or (c.type = 'department' and c.department_id = (select department_id from me()))
        or (c.type = 'office' and c.office_id = (select office_id from me()))))
);

-- ── Calls: the starter is the first participant; heartbeats extend your time in the call ──

create function start_call(ch uuid, p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare
  my uuid := (select id from me());
  c uuid;
begin
  -- no calls in Announcements or the company-wide chat (would ring everyone)
  if my is null or not is_member(ch) or exists (select 1 from channels where id = ch and (announcements or type = 'global')) then
    raise exception 'Not allowed';
  end if;
  insert into calls (channel_id, room, started_by) values (ch, p_room, my) returning id into c;
  insert into call_participants (call_id, employee_id) values (c, my);
end $$;

create function call_ping(p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare
  my uuid := (select id from me());
  c calls;
begin
  select * into c from calls where room = p_room;
  if my is null or c.id is null or not is_member(c.channel_id) then raise exception 'Not allowed'; end if;
  if c.ended_at is not null then return; end if;
  insert into call_participants (call_id, employee_id) values (c.id, my)
  on conflict (call_id, employee_id) do update set last_seen_at = now();
end $$;

create function end_call(p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c calls;
begin
  select * into c from calls where room = p_room;
  if (select id from me()) is null or c.id is null or not is_member(c.channel_id) then raise exception 'Not allowed'; end if;
  update calls set ended_at = now() where id = c.id and ended_at is null;
end $$;

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
returns table (id uuid, type channel_type, name text, unread bigint, last_at timestamptz, announcements boolean, avatar_url text, office_id uuid, office_name text)
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
    end,
    o.id, o.name -- sidebar nests department channels under their office
  from channels c
  left join departments d on d.id = c.department_id
  left join offices o on o.id = coalesce(c.office_id, d.office_id)
  left join channel_members mine on mine.channel_id = c.id and mine.employee_id = (select id from me())
  where is_member(c.id)
  order by 6 desc, 5 desc nulls last, 3
$$;

-- ── Announcements channel: admins and managers post, automated posts from triggers, everyone reads ──

insert into channels (name, type, announcements) values ('Announcements', 'group', true);
insert into channels (name, type) values ('General', 'global'); -- company-wide chat, everyone posts

-- system message (sender_id null) into the Announcements channel
create function post_announcement(body text) returns void
language sql security definer set search_path = public as $$
  insert into messages (channel_id, sender_id, body)
  select id, null, body from channels where announcements
$$;

-- skipped per row inside import_holidays() (one summary post instead)
create function announce_holiday() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.bulk_holidays', true), '') = 'on' then return new; end if;
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
  if old.role is null and new.role in ('employee', 'manager', 'hr') and new.joined_on >= current_date - 14 then
    perform post_announcement(format('Please welcome %s%s%s to Open Box Ventures LLP!', new.full_name,
      coalesce(', ' || new.designation, ''),
      coalesce(' in ' || (select name from departments where id = new.department_id), '')));
  end if;
  return new;
end $$;
create trigger announce_joiner after update of role on employees for each row execute function announce_joiner();

-- ── Holiday import + daily reminders (birthdays, anniversaries, holiday eve) ──

-- rows: [{date, name, office_id|null}]. All-or-nothing, exact duplicates (date+name+office) skipped.
-- Returns the number inserted; posts one summary announcement.
create function import_holidays(rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  perform set_config('app.bulk_holidays', 'on', true);
  with src as (
    select distinct (r->>'date')::date as date, trim(r->>'name') as name, nullif(r->>'office_id', '')::uuid as office_id
    from jsonb_array_elements(rows) r
  ), ins as (
    insert into holidays (date, name, office_id)
    select date, name, office_id from src s
    where not exists (select 1 from holidays h where h.date = s.date and h.name = s.name and h.office_id is not distinct from s.office_id)
    returning 1
  )
  select count(*) into n from ins;
  perform set_config('app.bulk_holidays', 'off', true);
  if n > 0 then
    perform post_announcement(format('%s holiday%s added to the calendar. See Leave for the full list.', n, case when n = 1 then '' else 's' end));
  end if;
  return n;
end $$;

-- does annual date d fall on `day`? Feb 29 counts on Feb 28 in non-leap years
create function reminder_match(d date, day date) returns boolean
language sql immutable as $$
  select to_char(d, 'MMDD') = to_char(day, 'MMDD')
    or (to_char(d, 'MMDD') = '0229' and to_char(day, 'MMDD') = '0228'
        and not ((extract(year from day)::int % 4 = 0 and extract(year from day)::int % 100 <> 0) or extract(year from day)::int % 400 = 0))
$$;

create function daily_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  day date := (now() at time zone 'Asia/Kolkata')::date;
  r record;
  posted int := 0;
begin
  for r in
    select e.id::text as ref, 'birthday' as kind, format('Happy birthday, %s!', e.full_name) as msg
    from employees e join employee_profiles p on p.employee_id = e.id
    where e.active and e.role is distinct from 'admin' and reminder_match(p.date_of_birth, day)
    union all
    select e.id::text, 'anniversary',
      format('Congratulations %s on %s year%s at Open Box Ventures LLP!', e.full_name, y, case when y = 1 then '' else 's' end)
    from employees e, lateral (select extract(year from day)::int - extract(year from e.joined_on)::int as y) t
    where e.active and e.role is distinct from 'admin' and e.joined_on is not null and y >= 1 and reminder_match(e.joined_on, day)
    union all
    select h.id::text, 'holiday', format('Reminder: tomorrow is %s%s', h.name,
      coalesce(' (' || (select name from offices where id = h.office_id) || ' office only)', ''))
    from holidays h where h.date = day + 1
  loop
    insert into reminder_log (day, kind, ref) values (day, r.kind, r.ref) on conflict do nothing;
    if found then perform post_announcement(r.msg); posted := posted + 1; end if;
  end loop;
  return posted;
end $$;

-- ── Payroll ──────────────────────────────────────────────────────────

create function add_salary(p_emp uuid, p_ctc numeric, p_from date, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or (my_role() = 'hr' and manages(p_emp))) then raise exception 'Not allowed'; end if;
  if exists (select 1 from employees where id = p_emp and role = 'admin') then raise exception 'Admins have no salary'; end if;
  insert into employee_salaries (employee_id, annual_ctc, effective_from, note, created_by)
  values (p_emp, p_ctc, p_from, nullif(trim(p_note), ''), (select id from me()));
exception when unique_violation then
  raise exception 'There is already a revision effective that day';
end $$;

create function save_bank_details(p_emp uuid, p_holder text, p_account text, p_ifsc text, p_bank text, p_pan text default null, p_uan text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_see_pay(p_emp) then raise exception 'Not allowed'; end if;
  insert into employee_bank (employee_id, holder_name, account_number, ifsc, bank_name, pan, uan)
  values (p_emp, trim(p_holder), trim(p_account), upper(trim(p_ifsc)), trim(p_bank), nullif(upper(trim(p_pan)), ''), nullif(trim(p_uan), ''))
  on conflict (employee_id) do update set holder_name = excluded.holder_name, account_number = excluded.account_number,
    ifsc = excluded.ifsc, bank_name = excluded.bank_name, pan = excluded.pan, uan = excluded.uan, updated_at = now();
end $$;

-- net / LOP amount are derived here so a sheet can't be inconsistent. days_in_month of the run's month.
create function payroll_derive(l payroll_lines, m date) returns payroll_lines
language plpgsql immutable as $$
begin
  l.lop_amount := round(l.gross / extract(day from (date_trunc('month', m) + interval '1 month - 1 day')) * l.lop_days, 2);
  l.net := l.gross - l.lop_amount - l.employee_pf - l.employee_esi - l.pt - l.tds - l.other_deductions;
  return l;
end $$;

-- p_lines: [{employee_id, basic, hra, special, gross, employee_pf, employer_pf, employee_esi, employer_esi, pt, tds, other_deductions, lop_days}]
-- computed by the app's calculator (lib/payroll.ts); scope checked per employee here.
create function create_payroll_run(p_month date, p_office uuid, p_lines jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  rid uuid;
  x record;
  l payroll_lines;
begin
  if not can_run_payroll(p_office) then raise exception 'Not allowed'; end if;
  -- no overlap between an org-wide sheet and an office sheet for the same month
  if exists (select 1 from payroll_runs where month = m and (office_id is null or p_office is null or office_id = p_office)) then
    raise exception 'A salary sheet already exists for that month';
  end if;
  insert into payroll_runs (month, office_id, created_by) values (m, p_office, (select id from me())) returning id into rid;
  for x in select * from jsonb_to_recordset(p_lines) as t(employee_id uuid, basic numeric, hra numeric, special numeric, gross numeric,
      employee_pf numeric, employer_pf numeric, employee_esi numeric, employer_esi numeric, pt numeric, tds numeric, other_deductions numeric, lop_days numeric)
  loop
    if not exists (select 1 from employees e where e.id = x.employee_id and e.active and coalesce(e.role, '') <> 'admin'
                   and (p_office is null or e.office_id = p_office) and (is_admin() or manages(e.id))) then
      raise exception 'Employee out of scope';
    end if;
    l := row(null, rid, x.employee_id, x.basic, x.hra, x.special, x.gross, coalesce(x.employee_pf, 0), coalesce(x.employer_pf, 0),
      coalesce(x.employee_esi, 0), coalesce(x.employer_esi, 0), coalesce(x.pt, 0), coalesce(x.tds, 0), coalesce(x.other_deductions, 0),
      coalesce(x.lop_days, 0), 0, 0);
    l := payroll_derive(l, m);
    insert into payroll_lines (run_id, employee_id, basic, hra, special, gross, employee_pf, employer_pf, employee_esi, employer_esi, pt, tds,
      other_deductions, lop_days, lop_amount, net)
    values (rid, l.employee_id, l.basic, l.hra, l.special, l.gross, l.employee_pf, l.employer_pf, l.employee_esi, l.employer_esi, l.pt, l.tds,
      l.other_deductions, l.lop_days, l.lop_amount, l.net);
  end loop;
  return rid;
end $$;

create function update_payroll_line(p_id uuid, p_lop numeric, p_tds numeric, p_other numeric) returns void
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; l payroll_lines;
begin
  select * into l from payroll_lines where id = p_id;
  select * into r from payroll_runs where id = l.run_id for update;
  if r.id is null or not can_run_payroll(r.office_id) then raise exception 'Not allowed'; end if;
  if r.status <> 'draft' then raise exception 'Only draft sheets can be edited'; end if;
  l.lop_days := p_lop; l.tds := p_tds; l.other_deductions := p_other;
  l := payroll_derive(l, r.month);
  update payroll_lines set lop_days = l.lop_days, tds = l.tds, other_deductions = l.other_deductions, lop_amount = l.lop_amount, net = l.net
  where id = p_id;
end $$;

create function submit_payroll_run(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r payroll_runs;
begin
  select * into r from payroll_runs where id = p_id for update;
  if r.id is null or not can_run_payroll(r.office_id) then raise exception 'Not allowed'; end if;
  if r.status <> 'draft' then raise exception 'Only draft sheets can be submitted'; end if;
  if not exists (select 1 from payroll_lines where run_id = r.id) then raise exception 'Sheet is empty'; end if;
  update payroll_runs set status = 'submitted', submitted_at = now(), review_note = null where id = r.id;
end $$;

-- admin only: approve (locks the sheet) or send back to draft with a note
create function review_payroll_run(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r payroll_runs;
begin
  if not is_admin() then raise exception 'Only admin can approve payroll'; end if;
  select * into r from payroll_runs where id = p_id for update;
  if r.id is null or r.status <> 'submitted' then raise exception 'Sheet is not awaiting approval'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then raise exception 'A note is required when rejecting'; end if;
  update payroll_runs set status = case when p_approve then 'approved' else 'draft' end::payroll_status,
    reviewed_by = (select id from me()), reviewed_at = now(), review_note = case when p_approve then null else trim(p_note) end
  where id = r.id;
end $$;

create function delete_payroll_run(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r payroll_runs;
begin
  select * into r from payroll_runs where id = p_id for update;
  if r.id is null or not can_run_payroll(r.office_id) then raise exception 'Not allowed'; end if;
  if r.status <> 'draft' then raise exception 'Only draft sheets can be deleted'; end if;
  delete from payroll_runs where id = r.id;
end $$;

-- ── Rate limiting ──

-- true = allowed. Fixed window of p_window_s seconds, p_max hits per key. One upsert, row-locked, so concurrent hits count.
-- ponytail: one row per user, never pruned; add a cleanup if keys ever stop being per-employee.
create function hit_rate_limit(p_key text, p_max int, p_window_s int) returns boolean
language sql volatile security definer set search_path = public as $$
  insert into rate_limits as r values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_s) then now() else r.window_start end,
    hits         = case when r.window_start < now() - make_interval(secs => p_window_s) then 1 else r.hits + 1 end
  returning hits <= p_max;
$$;

-- ── Storage (private; files served via signed URLs after an RLS-checked lookup) ──

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    -- browser uploads directly via signed URL, so the bucket enforces the 10 MB cap
    -- MIME allowlist: no html/svg/xml/js, so nothing uploaded can render as a page from the storage origin
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    select id, id, false, 10485760, array[
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v',
      'application/pdf', 'text/plain', 'text/csv', 'application/zip', 'application/octet-stream',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
    from unnest(array['leave-docs', 'attachments']) id
    on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
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
revoke execute on function daily_reminders() from public, anon, authenticated; -- cron route (service key) only
revoke execute on function hit_rate_limit(text, int, int) from public, anon, authenticated; -- server key only

-- updates limited to the columns the app actually changes
-- (leave_requests, regularizations, payroll, reminder_log: no direct writes at all, functions only)
revoke update on attendance, leave_requests, channel_members, messages, todos from anon, authenticated;
grant update (mode, check_in_at, check_out_at, note) on attendance to authenticated;
grant update (last_read_at) on channel_members to authenticated;
grant update (title, due_on, done_at) on todos to authenticated;
revoke insert, update, delete on regularizations, employee_salaries, employee_bank, payroll_runs, payroll_lines, calls, call_participants from anon, authenticated;
revoke all on reminder_log, rate_limits from anon, authenticated;

-- signed-out requests get nothing
revoke all on all tables in schema public from anon;
