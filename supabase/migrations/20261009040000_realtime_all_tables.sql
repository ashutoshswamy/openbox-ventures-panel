-- Live refresh on every page: publish the rest of the app tables. Realtime applies RLS per subscriber,
-- so salary/bank/payroll events only reach people who can already select those rows.
-- reminder_log and rate_limits stay out (server only, no policies).
alter publication supabase_realtime add table
  offices, departments, leave_types, leave_carry_forward, channels, channel_members, calls, call_participants,
  employee_profiles, employee_salaries, employee_bank, payroll_runs, payroll_lines;
