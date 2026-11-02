-- Daylight saving hours: when dst_enabled, the office runs on dst_work_start/dst_work_end instead of work_start/work_end.
-- work_start_eff / work_end_eff are what everything reads.
alter table offices
  add column dst_enabled boolean not null default false,
  add column dst_work_start time not null default '09:30',
  add column dst_work_end time not null default '18:30',
  add column work_start_eff time generated always as (case when dst_enabled then dst_work_start else work_start end) stored,
  add column work_end_eff time generated always as (case when dst_enabled then dst_work_end else work_end end) stored;

create or replace view attendance_report with (security_invoker = true) as
select a.*, e.full_name, e.email, e.office_id, e.department_id, o.name as office_name, o.timezone,
  (a.check_in_at at time zone o.timezone)::time > o.work_start_eff + make_interval(mins => o.grace_min) as late,
  (a.check_out_at at time zone o.timezone) < a.date + o.work_end_eff + case when o.work_end_eff <= o.work_start_eff then interval '1 day' else interval '0' end as early_leave,
  round(extract(epoch from a.check_out_at - a.check_in_at) / 3600.0, 2) as hours
from attendance a
join employees e on e.id = a.employee_id
left join offices o on o.id = e.office_id;
