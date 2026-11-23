-- Regularizations: make sure table, RLS read policy, grants and RPCs exist and match schema.sql. Idempotent.
-- Also lets an overnight shift be requested (check-out earlier than check-in = next day).

create table if not exists regularizations (
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
create unique index if not exists regularizations_employee_id_date_idx
  on regularizations (employee_id, date) where status in ('pending', 'approved');

alter table regularizations enable row level security;
drop policy if exists read on regularizations;
create policy read on regularizations for select to authenticated
  using (employee_id = (select id from me()) or manages(employee_id));

grant select on regularizations to authenticated;
revoke insert, update, delete on regularizations from anon, authenticated;

create or replace function request_regularization(p_date date, p_mode attendance_mode, p_in time, p_out time, p_reason text)
returns regularizations language plpgsql security definer set search_path = public as $$
declare
  e employees := me();
  tz text;
  r regularizations;
begin
  if e.id is null then raise exception 'Not an active employee'; end if;
  if my_role() = 'admin' then raise exception 'Admins don''t use attendance or leave'; end if;
  if p_date is null or p_in is null or p_out is null then raise exception 'Date, check-in and check-out are required'; end if;
  if p_date > my_today() then raise exception 'Can''t regularize a future date'; end if;
  if p_out = p_in then raise exception 'Check-out must differ from check-in'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Reason is required'; end if;
  perform 1 from employees where id = e.id for update; -- serialize the monthly count
  if (select count(*) from regularizations
      where employee_id = e.id and status in ('pending', 'approved')
        and date_trunc('month', date) = date_trunc('month', p_date)) >= 5 then
    raise exception 'Regularization limit reached: 5 per month';
  end if;
  tz := coalesce((select timezone from offices where id = e.office_id), 'Asia/Kolkata');
  insert into regularizations (employee_id, date, mode, check_in_at, check_out_at, reason)
  values (e.id, p_date, p_mode, (p_date + p_in) at time zone tz,
          (p_date + p_out + case when p_out < p_in then interval '1 day' else interval '0' end) at time zone tz, -- earlier out = overnight
          trim(p_reason))
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'You already have a regularization for that day';
end $$;

create or replace function review_regularization(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r regularizations;
begin
  select * into r from regularizations where id = p_id and status = 'pending' for update;
  if r.id is null then raise exception 'Request not found or already reviewed'; end if;
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

grant execute on function request_regularization(date, attendance_mode, time, time, text) to authenticated;
grant execute on function review_regularization(uuid, boolean, text) to authenticated;
