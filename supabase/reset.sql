-- ⚠️ Deletes ALL app data and objects. Then run schema.sql to rebuild.
-- Leaves Supabase internals (auth, storage, other schemas) alone.
-- Storage files are not deleted: Supabase blocks SQL deletes on storage.objects;
-- empty the leave-docs / attachments buckets from the dashboard if needed.

drop view if exists leave_balances, attendance_report cascade;

-- (announcements table, user_role type: from older schema versions, dropped if still around)
drop table if exists
  todos, employee_profiles, issues, messages, channel_members, channels, announcements,
  leave_carry_forward, leave_requests, leave_types, holidays,
  attendance, employees, departments, offices
cascade;

drop function if exists
  my_role, me, is_admin, manages, is_member, distance_m, my_today,
  check_in, check_out, leave_days, apply_leave, cancel_leave, close_year,
  create_department_channel, rename_department_channel, dm_with, my_channels,
  post_announcement, announce_holiday, announce_office, announce_joiner, orphan_uploads
cascade;

drop type if exists attendance_mode, leave_status, leave_accrual, channel_type, issue_status, user_role cascade;
