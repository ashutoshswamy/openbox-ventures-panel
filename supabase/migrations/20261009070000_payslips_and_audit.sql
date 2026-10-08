-- Payslips: employees read their own line + run once the sheet is approved.
-- security definer helper: lines → runs → lines policies would otherwise recurse.
create or replace function is_approved_run(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from payroll_runs where id = r and status = 'approved')
$$;

drop policy if exists own on payroll_lines;
create policy own on payroll_lines for select to authenticated
  using (employee_id = (select id from me()) and is_approved_run(run_id));
drop policy if exists own on payroll_runs;
create policy own on payroll_runs for select to authenticated
  using (status = 'approved' and exists (select 1 from payroll_lines l where l.run_id = payroll_runs.id and l.employee_id = (select id from me())));

-- Audit log: who changed what on sensitive tables. Written by triggers only, read by admins.
-- actor_id null = server key (first sign-in link, role sync, cron).
-- ponytail: no retention; add a cron delete of rows older than N years if the table gets big.
create table if not exists audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid, -- no FKs: the log outlives deleted employees (and cascaded deletes log rows mid-delete)
  employee_id uuid, -- whose record it is
  action      text not null check (action in ('insert', 'update', 'delete')),
  table_name  text not null,
  row_id      text,
  old         jsonb, -- update: changed columns only
  new         jsonb
);
create index if not exists audit_log_at on audit_log (at desc);
create index if not exists audit_log_employee on audit_log (employee_id, at desc);
alter table audit_log enable row level security;
drop policy if exists read on audit_log;
create policy read on audit_log for select to authenticated using (is_admin());
revoke insert, update, delete on audit_log from anon, authenticated;

create or replace function audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  k text;
  secret text[] := array['holder_name', 'account_number', 'ifsc', 'bank_name', 'pan', 'uan'];
begin
  -- app bookkeeping, not a change anyone made
  o := o - 'avatar_url' - 'clerk_user_id';
  n := n - 'avatar_url' - 'clerk_user_id';
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if o->k is not distinct from n->k then o := o - k; n := n - k; end if;
    end loop;
    if n = '{}' then return null; end if;
  end if;
  -- bank: record which fields changed, never the values
  if tg_table_name = 'employee_bank' then
    o := o || coalesce((select jsonb_object_agg(key, '•••'::text) from jsonb_each(o) where key = any (secret)), '{}');
    n := n || coalesce((select jsonb_object_agg(key, '•••'::text) from jsonb_each(n) where key = any (secret)), '{}');
  end if;
  insert into audit_log (actor_id, employee_id, action, table_name, row_id, old, new)
  values ((select id from me()),
          case when tg_table_name = 'employees' then (r->>'id')::uuid else (r->>'employee_id')::uuid end,
          lower(tg_op), tg_table_name, coalesce(r->>'id', r->>'employee_id'), o, n);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['employees', 'employee_salaries', 'employee_bank', 'payroll_runs', 'leave_requests',
                           'regularizations', 'leave_types', 'holidays', 'offices', 'departments'] loop
    execute format('drop trigger if exists audit on %I', t);
    execute format('create trigger audit after insert or update or delete on %I for each row execute function audit()', t);
  end loop;
end $$;
-- lines: edits only (a new sheet inserts one row per employee - the run row covers that)
drop trigger if exists audit on payroll_lines;
create trigger audit after update on payroll_lines for each row execute function audit();
