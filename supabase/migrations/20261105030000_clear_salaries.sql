-- Remove salary records. One person's whole history (admin, or HR for their office), or every salary in the company (admin only).
-- Already generated salary sheets (payroll_runs / payroll_lines) are separate records and stay as they are.
create function clear_salaries(p_emp uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_emp is null then
    if not is_admin() then raise exception 'Only an admin can clear every salary'; end if;
    delete from employee_salaries;
  else
    if not (is_admin() or (my_role() = 'hr' and manages(p_emp))) then raise exception 'Not allowed'; end if;
    delete from employee_salaries where employee_id = p_emp;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;
