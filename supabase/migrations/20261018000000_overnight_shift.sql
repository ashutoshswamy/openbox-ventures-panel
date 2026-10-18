-- Overnight shifts (e.g. 17:30-02:30): one shift = the latest check-in in the last 18h, even after midnight.

create or replace function check_in(p_mode attendance_mode, p_lat float8 default null, p_lng float8 default null)
returns attendance language plpgsql security definer set search_path = public as $$
declare
  e employees := me();
  o offices;
  d float8;
  r attendance;
begin
  if e.id is null then raise exception 'Not an active employee'; end if;
  if my_role() = 'admin' then raise exception 'Admins don''t use attendance or leave'; end if;
  if exists (select 1 from attendance where employee_id = e.id and check_in_at > now() - interval '18 hours') then
    raise exception 'Already checked in today';
  end if;
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

create or replace function check_out() returns attendance
language plpgsql security definer set search_path = public as $$
declare r attendance;
begin
  update attendance set check_out_at = now()
  where id = (select id from attendance
              where employee_id = (select id from me()) and check_out_at is null and check_in_at > now() - interval '18 hours'
              order by check_in_at desc limit 1)
  returning * into r;
  if r.id is null then raise exception 'No open check-in'; end if;
  return r;
end $$;

-- the shift the employee is on now (or just finished): latest check-in within 18h
create or replace function my_shift() returns attendance
language sql stable security definer set search_path = public as $$
  select a from attendance a
  where a.employee_id = (select id from me()) and a.check_in_at > now() - interval '18 hours'
  order by a.check_in_at desc limit 1
$$;

-- early_leave: compare against the shift's end, which is the next day for overnight shifts
create or replace view attendance_report with (security_invoker = true) as
select a.*, e.full_name, e.email, e.office_id, e.department_id, o.name as office_name, o.timezone,
  (a.check_in_at at time zone o.timezone)::time > o.work_start + make_interval(mins => o.grace_min) as late,
  (a.check_out_at at time zone o.timezone) < a.date + o.work_end + case when o.work_end <= o.work_start then interval '1 day' else interval '0' end as early_leave,
  round(extract(epoch from a.check_out_at - a.check_in_at) / 3600.0, 2) as hours
from attendance a
join employees e on e.id = a.employee_id
left join offices o on o.id = e.office_id;
