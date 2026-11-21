-- "DELETE requires a WHERE clause": Supabase's unqualified-delete guard blocks the bulk branch too. Add a no-op WHERE to satisfy it.
create or replace function clear_salaries(p_emp uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_emp is null then
    if not is_admin() then raise exception 'Only an admin can clear every salary'; end if;
    delete from employee_salaries where true;
  else
    if not (is_admin() or (my_role() = 'hr' and manages(p_emp))) then raise exception 'Not allowed'; end if;
    delete from employee_salaries where employee_id = p_emp;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;
