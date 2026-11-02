-- Work reports (daily / weekly / monthly, per office switch) filed at check-out, manager-compiled reports, and performance reviews.
-- Run after schema.sql and the earlier migrations.

-- ── Work reports ─────────────────────────────────────────────────────

alter table offices
  add column report_daily   boolean not null default false,
  add column report_weekly  boolean not null default false,
  add column report_monthly boolean not null default false;

-- Filed only through check_out(). daily: period = the shift date; weekly: Mon-Sun; monthly: calendar month.
create table work_reports (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees on delete cascade,
  kind         text not null check (kind in ('daily', 'weekly', 'monthly')),
  period_start date not null,
  period_end   date not null,
  body         text not null check (length(trim(body)) between 1 and 5000),
  created_at   timestamptz not null default now(),
  unique (employee_id, kind, period_start)
);
create index on work_reports (employee_id, period_end);

-- A manager's edited write-up of the filed reports (slides, PDF, etc.). Private to the author (+ admin).
create table compiled_reports (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references employees on delete cascade,
  title        text not null check (length(trim(title)) between 1 and 200),
  kind         text not null check (kind in ('daily', 'weekly', 'monthly')),
  period_start date not null,
  period_end   date not null check (period_end >= period_start),
  body         text not null check (length(body) <= 200000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table work_reports     enable row level security;
alter table compiled_reports enable row level security;

create policy read on work_reports for select to authenticated
  using (employee_id = (select id from me()) or manages(employee_id));
create policy own on compiled_reports for all to authenticated
  using (author_id = (select id from me()) or is_admin())
  with check (my_role() in ('manager', 'branch_head', 'hr', 'admin') and (author_id = (select id from me()) or is_admin()));

-- true when no working day (office work_days minus holidays) is left in (d, last]
create function last_workday(o offices, d date, last date) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from generate_series(d + 1, last, interval '1 day') g(x)
    where extract(isodow from g.x)::int = any (o.work_days)
      and not exists (select 1 from holidays h where h.date = g.x::date and (h.office_id is null or h.office_id = o.id)))
$$;

-- reports the employee must file when checking out of the shift dated d
create function reports_due_on(emp employees, d date) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare
  o offices;
  due text[] := '{}';
begin
  select * into o from offices where id = emp.office_id;
  if o.id is null then return due; end if;
  if o.report_daily then due := array_append(due, 'daily'); end if;
  if o.report_weekly and last_workday(o, d, (date_trunc('week', d) + interval '6 days')::date) then due := array_append(due, 'weekly'); end if;
  if o.report_monthly and last_workday(o, d, (date_trunc('month', d) + interval '1 month' - interval '1 day')::date) then due := array_append(due, 'monthly'); end if;
  return due;
end $$;

create function reports_due() returns text[]
language sql stable security definer set search_path = public as $$
  select reports_due_on(me(), coalesce((my_shift()).date, my_today()))
$$;

-- replaces check_out(): same overnight-shift logic, plus the reports the office requires
drop function check_out();
create function check_out(p_daily text default null, p_weekly text default null, p_monthly text default null)
returns attendance language plpgsql security definer set search_path = public as $$
declare
  e employees := me();
  r attendance;
  due text[];
  k text;
  body text;
  s date;
  f date;
begin
  select * into r from attendance
  where employee_id = e.id and check_out_at is null and check_in_at > now() - interval '18 hours'
  order by check_in_at desc limit 1;
  if r.id is null then raise exception 'No open check-in'; end if;

  due := reports_due_on(e, r.date);
  foreach k in array due loop
    body := trim(case k when 'daily' then p_daily when 'weekly' then p_weekly else p_monthly end);
    if coalesce(body, '') = '' then raise exception 'Your % report is required to check out', k; end if;
    if length(body) > 5000 then raise exception 'Your % report is too long (max 5000 characters)', k; end if;
    s := case k when 'daily' then r.date when 'weekly' then date_trunc('week', r.date)::date else date_trunc('month', r.date)::date end;
    f := case k when 'daily' then r.date when 'weekly' then (date_trunc('week', r.date) + interval '6 days')::date
         else (date_trunc('month', r.date) + interval '1 month' - interval '1 day')::date end;
    insert into work_reports (employee_id, kind, period_start, period_end, body) values (e.id, k, s, f, body)
    on conflict (employee_id, kind, period_start) do update set body = excluded.body, created_at = now();
  end loop;

  update attendance set check_out_at = now() where id = r.id returning * into r;
  return r;
end $$;

-- ── Performance reviews ──────────────────────────────────────────────
-- Admin (any office) or HR / branch head (own office) opens a cycle: one review row per person in scope.
-- Employee self-assesses first; then whoever manages them rates (manager: own dept, branch head / HR: office, admin: anyone).

create table review_cycles (
  id           uuid primary key default gen_random_uuid(),
  office_id    uuid references offices on delete cascade, -- null = whole org
  name         text not null check (length(trim(name)) between 1 and 120),
  period_start date not null,
  period_end   date not null check (period_end >= period_start),
  status       text not null default 'open' check (status in ('open', 'closed')),
  created_by   uuid references employees on delete set null,
  created_at   timestamptz not null default now()
);

create table reviews (
  id            uuid primary key default gen_random_uuid(),
  cycle_id      uuid not null references review_cycles on delete cascade,
  employee_id   uuid not null references employees on delete cascade,
  self_rating   smallint check (self_rating between 1 and 5),
  self_comments text check (length(self_comments) <= 5000),
  self_at       timestamptz,
  mgr_rating    smallint check (mgr_rating between 1 and 5),
  mgr_comments  text check (length(mgr_comments) <= 5000),
  mgr_by        uuid references employees on delete set null,
  mgr_at        timestamptz,
  unique (cycle_id, employee_id)
);
create index on reviews (employee_id);

alter table review_cycles enable row level security;
alter table reviews       enable row level security;

create policy read on review_cycles for select to authenticated using ((select id from me()) is not null);
create policy read on reviews for select to authenticated using (employee_id = (select id from me()) or manages(employee_id));

create function start_review_cycle(p_name text, p_office uuid, p_start date, p_end date) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e employees := me();
  c uuid;
begin
  if not (is_admin() or (my_role() in ('hr', 'branch_head') and p_office is not null and p_office = e.office_id)) then
    raise exception 'Not allowed to start a review cycle for this office';
  end if;
  if p_end < p_start then raise exception 'End date is before start date'; end if;
  insert into review_cycles (office_id, name, period_start, period_end, created_by)
  values (p_office, trim(p_name), p_start, p_end, e.id) returning id into c;
  insert into reviews (cycle_id, employee_id)
  select c, x.id from employees x
  where x.active and x.role is not null and x.role <> 'admin' and (p_office is null or x.office_id = p_office);
  return c;
end $$;

create function close_review_cycle(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update review_cycles set status = 'closed'
  where id = p_id and (is_admin() or created_by = (select id from me()));
  if not found then raise exception 'Cycle not found or not yours to close'; end if;
end $$;

create function submit_self_review(p_id uuid, p_rating int, p_comments text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_comments), '') = '' then raise exception 'Add a few words about your work'; end if;
  update reviews r set self_rating = p_rating, self_comments = trim(p_comments), self_at = now()
  where r.id = p_id and r.employee_id = (select id from me()) and r.mgr_at is null
    and exists (select 1 from review_cycles c where c.id = r.cycle_id and c.status = 'open');
  if not found then raise exception 'Review not found, already rated by your manager, or cycle closed'; end if;
end $$;

create function submit_manager_review(p_id uuid, p_rating int, p_comments text) returns void
language plpgsql security definer set search_path = public as $$
declare r reviews;
begin
  if coalesce(trim(p_comments), '') = '' then raise exception 'Add feedback for the employee'; end if;
  select * into r from reviews where id = p_id;
  if r.id is null or r.employee_id = (select id from me()) or not manages(r.employee_id) then raise exception 'Not allowed to rate this person'; end if;
  if not exists (select 1 from review_cycles where id = r.cycle_id and status = 'open') then raise exception 'Cycle is closed'; end if;
  if r.self_at is null then raise exception 'Wait for the employee''s self-assessment first'; end if;
  update reviews set mgr_rating = p_rating, mgr_comments = trim(p_comments), mgr_by = (select id from me()), mgr_at = now() where id = r.id;
end $$;

alter publication supabase_realtime add table work_reports, reviews;
