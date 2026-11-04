-- How an employee checks in. 'office' = one Check in button, location required and geofenced to their office.
-- 'wfh' = may check in from the office or from home (both buttons). Existing staff keep both buttons; new invites default to 'office'.
alter table employees add column work_mode text not null default 'wfh' check (work_mode in ('office', 'wfh'));
alter table employees alter column work_mode set default 'office';

create or replace function check_in(p_mode attendance_mode, p_lat float8 default null, p_lng float8 default null)
returns attendance language plpgsql security definer set search_path = public as $$
declare
  e employees := me();
  o offices;
  d float8;
  r attendance;
  sd date := my_today();
begin
  if e.id is null then raise exception 'Not an active employee'; end if;
  if my_role() = 'admin' then raise exception 'Admins don''t use attendance or leave'; end if;
  if p_mode = 'wfh' and e.work_mode = 'office' then
    raise exception 'Your account is set to in-office check-in. Ask an admin if you need to work from home.';
  end if;
  if exists (select 1 from attendance where employee_id = e.id and check_in_at > now() - interval '18 hours') then
    raise exception 'Already checked in today';
  end if;
  select * into o from offices where id = e.office_id;
  -- still inside yesterday's overnight shift → that working day
  if o.id is not null and o.work_end_eff <= o.work_start_eff and (now() at time zone o.timezone)::time < o.work_end_eff then
    sd := sd - 1;
  end if;
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
  values (e.id, sd, p_mode, p_lat, p_lng)
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'Already checked in today';
end $$;
