-- Live UI refresh (components/live-refresh.tsx) for non-chat pages. messages is already published (schema.sql).
-- Not channel_members: opening a chat writes last_read_at → refresh loop.
alter publication supabase_realtime add table leave_requests, attendance, issues, holidays, employees;
