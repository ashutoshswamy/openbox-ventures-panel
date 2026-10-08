-- Branch head role: head of all departments in their office.
-- manager narrows to own office_id + department_id; branch_head / hr keep the whole office_id.
-- Leave step 1: the employee's department manager, or the branch head. Manager leave: branch head only.
-- Run after schema.sql. Before running: give every existing manager a department_id (or make them branch_head),
-- otherwise they manage nobody.

alter table employees drop constraint employees_role_check;
alter table employees add constraint employees_role_check check (role in ('employee', 'manager', 'branch_head', 'hr', 'admin'));

create or replace function me() returns employees
language sql stable security definer set search_path = public as $$
  select * from employees
  where clerk_user_id = auth.jwt()->>'sub' and active
    and my_role() in ('employee', 'manager', 'branch_head', 'hr', 'admin')
$$;

create or replace function manages(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from employees e, me() m
    where e.id = emp and e.office_id = m.office_id and e.id <> m.id
      and (my_role() in ('branch_head', 'hr') or (my_role() = 'manager' and e.department_id = m.department_id))
  )
$$;

drop policy send on messages;
create policy send on messages for insert to authenticated with check (
  is_member(channel_id) and sender_id = (select id from me())
  and (attachment_path is null or attachment_path like (select id from me())::text || '/%') -- own uploads only
  and (is_admin() or my_role() in ('manager', 'branch_head', 'hr') or not exists (select 1 from channels c where c.id = channel_id and c.announcements)) -- admins + managers + branch heads + HR
);

-- Two-step approval: first approver → 'manager_approved' → HR (or admin) final 'approved'.
-- First approver: the employee's department manager, or the branch head (anyone below them in the office).
-- HR/admin may decide straight from 'pending' only if admin, the employee is a branch head, or nobody can give step 1.
-- Manager leave: branch head only at step 1. HR / branch head leave: no step 1 (HR leave: admin only).
create or replace function review_leave(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r leave_requests;
  emp employees;
  rl text := my_role();
  who uuid := (select id from me());
  skip boolean;
begin
  select * into r from leave_requests where id = p_id and status in ('pending', 'manager_approved') for update;
  if r.id is null then raise exception 'Request not found or already reviewed'; end if;
  if r.employee_id = who or not manages(r.employee_id) then raise exception 'Not allowed to review this request'; end if;
  select * into emp from employees where id = r.employee_id;
  skip := is_admin() or emp.role = 'branch_head'
    or not exists (select 1 from employees m where m.office_id = emp.office_id and m.active and m.id <> emp.id
      and (m.role = 'branch_head' or (m.role = 'manager' and emp.role = 'employee' and m.department_id = emp.department_id)));

  if rl in ('manager', 'branch_head') then
    if emp.role in ('hr', 'branch_head') or (rl = 'manager' and emp.role = 'manager') then raise exception 'Only HR can give final approval'; end if;
    if r.status = 'manager_approved' then raise exception 'Only HR can give final approval'; end if;
    update leave_requests set
      status = case when p_approve then 'manager_approved' else 'rejected' end::leave_status,
      manager_reviewed_by = who, manager_reviewed_at = now(), manager_note = p_note,
      reviewed_by = case when p_approve then null else who end,
      reviewed_at = case when p_approve then null else now() end,
      review_note = case when p_approve then null else p_note end
    where id = r.id;
  else
    if emp.role = 'hr' and not is_admin() then raise exception 'Only admin can review HR leave'; end if;
    if r.status = 'pending' and not skip then raise exception 'Waiting for manager approval'; end if;
    update leave_requests set
      status = case when p_approve then 'approved' else 'rejected' end::leave_status,
      reviewed_by = who, reviewed_at = now(), review_note = p_note
    where id = r.id;
  end if;
end $$;

create or replace function announce_joiner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role is null and new.role in ('employee', 'manager', 'branch_head', 'hr') and new.joined_on >= current_date - 14 then
    perform post_announcement(format('Please welcome %s%s%s to Open Box Ventures LLP!', new.full_name,
      coalesce(', ' || new.designation, ''),
      coalesce(' in ' || (select name from departments where id = new.department_id), '')));
  end if;
  return new;
end $$;
