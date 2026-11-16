-- Preserve historical salary snapshots; new sheets supply Other Allowance explicitly.
alter table payroll_lines add column if not exists other_allowance numeric(12,2) not null default 0 check (other_allowance >= 0);

create or replace function create_payroll_run(p_month date, p_office uuid, p_lines jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  rid uuid;
  x record;
  l payroll_lines;
begin
  if not can_run_payroll(p_office) then raise exception 'Not allowed'; end if;
  -- no overlap between an org-wide sheet and an office sheet for the same month
  if exists (select 1 from payroll_runs where month = m and (office_id is null or p_office is null or office_id = p_office)) then
    raise exception 'A salary sheet already exists for that month';
  end if;
  insert into payroll_runs (month, office_id, created_by) values (m, p_office, (select id from me())) returning id into rid;
  for x in select * from jsonb_to_recordset(p_lines) as t(employee_id uuid, basic numeric, hra numeric, special numeric, other_allowance numeric, gross numeric,
      employee_pf numeric, employer_pf numeric, employee_esi numeric, employer_esi numeric, pt numeric, tds numeric, other_deductions numeric, lop_days numeric)
  loop
    if not exists (select 1 from employees e where e.id = x.employee_id and e.active and coalesce(e.role, '') <> 'admin'
                   and (p_office is null or e.office_id = p_office) and (is_admin() or manages(e.id))) then
      raise exception 'Employee out of scope';
    end if;
    l := row(null, rid, x.employee_id, x.basic, x.hra, x.special, x.gross, coalesce(x.employee_pf, 0), coalesce(x.employer_pf, 0),
      coalesce(x.employee_esi, 0), coalesce(x.employer_esi, 0), coalesce(x.pt, 0), coalesce(x.tds, 0), coalesce(x.other_deductions, 0),
      coalesce(x.lop_days, 0), 0, 0, coalesce(x.other_allowance, 0));
    l := payroll_derive(l, m);
    insert into payroll_lines (run_id, employee_id, basic, hra, special, gross, employee_pf, employer_pf, employee_esi, employer_esi, pt, tds,
      other_deductions, lop_days, lop_amount, net, other_allowance)
    values (rid, l.employee_id, l.basic, l.hra, l.special, l.gross, l.employee_pf, l.employer_pf, l.employee_esi, l.employer_esi, l.pt, l.tds,
      l.other_deductions, l.lop_days, l.lop_amount, l.net, l.other_allowance);
  end loop;
  return rid;
end $$;
