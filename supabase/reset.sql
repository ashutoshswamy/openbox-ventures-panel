-- ⚠️ Deletes ALL app data and objects. Then run schema.sql to rebuild.
-- Leaves Supabase internals (auth, storage, other schemas) alone.
-- Storage files are not deleted: Supabase blocks SQL deletes on storage.objects;
-- empty the leave-docs / attachments buckets from the dashboard if needed.

drop view if exists leave_balances, attendance_report cascade;

-- (announcements table, user_role type: from older schema versions, dropped if still around)
drop table if exists
  rate_limits, call_participants, calls, payroll_lines, payroll_runs, employee_bank, employee_salaries, reminder_log, regularizations, todos, employee_profiles, issues, messages, channel_members, channels, announcements,
  leave_carry_forward, leave_requests, leave_types, holidays,
  attendance, employees, departments, offices
cascade;

drop function if exists
  next_employee_code, my_role, me, is_admin, manages, is_member, distance_m, my_today,
  check_in, check_out, leave_days, apply_leave, cancel_leave, close_year,
  create_department_channel, rename_department_channel, create_office_channel, rename_office_channel, dm_with, dm_peer, my_channels, start_call, call_ping, end_call,
  post_announcement, announce_holiday, announce_office, announce_joiner, orphan_uploads,
  hit_rate_limit, can_see_pay, can_run_payroll, add_salary, save_bank_details, request_bank_edit, allow_bank_edit, payroll_derive, create_payroll_run, update_payroll_line,
  submit_payroll_run, review_payroll_run, delete_payroll_run,
  import_holidays, daily_reminders, reminder_match, employees_no_cycle, request_regularization, review_regularization, update_leave_doc, review_leave
cascade;

drop type if exists attendance_mode, leave_status, leave_accrual, channel_type, issue_status, payroll_status, user_role cascade;
