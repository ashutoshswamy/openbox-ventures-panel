-- HR role: office-scoped, same powers as a manager over their office_id.
alter table employees drop constraint employees_role_check;
alter table employees add constraint employees_role_check check (role in ('employee', 'manager', 'hr', 'admin'));

create or replace function me() returns employees
language sql stable security definer set search_path = public as $$
  select * from employees
  where clerk_user_id = auth.jwt()->>'sub' and active
    and my_role() in ('employee', 'manager', 'hr', 'admin')
$$;

create or replace function manages(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from employees e, me() m
    where e.id = emp and my_role() in ('manager', 'hr') and e.office_id = m.office_id and e.id <> m.id
  )
$$;

drop policy send on messages;
create policy send on messages for insert to authenticated with check (
  is_member(channel_id) and sender_id = (select id from me())
  and (attachment_path is null or attachment_path like (select id from me())::text || '/%') -- own uploads only
  and (is_admin() or my_role() in ('manager', 'hr') or not exists (select 1 from channels c where c.id = channel_id and c.announcements)) -- admins + managers + HR
);

create or replace function announce_joiner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role is null and new.role in ('employee', 'manager', 'hr') and new.joined_on >= current_date - 14 then
    perform post_announcement(format('Please welcome %s%s%s to Open Box Ventures LLP!', new.full_name,
      coalesce(', ' || new.designation, ''),
      coalesce(' in ' || (select name from departments where id = new.department_id), '')));
  end if;
  return new;
end $$;
