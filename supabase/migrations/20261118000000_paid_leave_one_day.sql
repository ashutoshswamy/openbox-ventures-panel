-- Paid leave types: max 1 day per request; longer absences use LOP (unpaid type) or WFH.
create or replace function apply_leave(p_type uuid, p_start date, p_end date, p_half boolean,
                            p_reason text default null, p_doc text default null)
returns leave_requests language plpgsql security definer set search_path = public as $$
declare
  e employees := me();
  t leave_types;
  n numeric;
  avail numeric;
  r leave_requests;
begin
  if e.id is null then raise exception 'Not an active employee'; end if;
  if my_role() = 'admin' then raise exception 'Admins don''t use attendance or leave'; end if;
  select * into t from leave_types where id = p_type and active;
  if t.id is null then raise exception 'Invalid leave type'; end if;
  if p_end < p_start then raise exception 'End date is before start date'; end if;
  if extract(year from p_start) <> extract(year from p_end) then raise exception 'Split leave that crosses a year into two requests'; end if;
  if p_half and not t.allow_half_day then raise exception '% does not allow half days', t.name; end if;
  if p_half and p_start <> p_end then raise exception 'Half day must be a single date'; end if;

  n := leave_days(e.id, p_start, p_end, p_half);
  if n = 0 then raise exception 'No working days in that range'; end if;
  if t.paid and n > 1 then raise exception 'Paid leave is limited to 1 day per request. Apply for LOP or WFH for longer leave'; end if;

  if exists (select 1 from leave_requests
             where employee_id = e.id and status in ('pending', 'manager_approved', 'approved')
               and start_date <= p_end and end_date >= p_start) then
    raise exception 'Overlaps an existing request';
  end if;

  if p_doc is not null and p_doc not like e.id::text || '/%' then raise exception 'Invalid document'; end if;
  if t.doc_required_after_days is not null and n > t.doc_required_after_days and p_doc is null then
    raise exception 'A document is required for % leave over % days', t.name, t.doc_required_after_days;
  end if;

  -- ponytail: balance enforced for current year only; next-year requests left to the reviewer
  if t.paid and extract(year from p_start) = extract(year from current_date) then
    select balance - pending into avail from leave_balances where employee_id = e.id and leave_type_id = t.id;
    if n > coalesce(avail, 0) then
      raise exception 'Not enough % balance: % available, % requested', t.name, coalesce(avail, 0), n;
    end if;
  end if;

  insert into leave_requests (employee_id, leave_type_id, start_date, end_date, half_day, days, reason, doc_path)
  values (e.id, t.id, p_start, p_end, p_half, n, p_reason, p_doc)
  returning * into r;
  return r;
end $$;
