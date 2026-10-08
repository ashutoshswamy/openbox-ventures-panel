-- Admins: one-to-one chats with anyone (other admins or employees). Still no groups for admins.
-- Non-admins can't start a DM with an admin, but can reply in one an admin opened.

create or replace function dm_with(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  my uuid := (select id from me());
  ch uuid;
begin
  if my is null then raise exception 'Not an active employee'; end if;
  if other = my then raise exception 'Cannot DM yourself'; end if;
  if not exists (select 1 from employees where id = other and active) then raise exception 'Unknown employee'; end if;
  select a.channel_id into ch
  from channel_members a
  join channel_members b on b.channel_id = a.channel_id and b.employee_id = other
  join channels c on c.id = a.channel_id and c.type = 'dm'
  where a.employee_id = my
  limit 1;
  if ch is null then
    if not is_admin() and exists (select 1 from employees where id = other and role = 'admin') then
      raise exception 'Admins can''t be messaged directly. Use Report an issue instead.';
    end if;
    insert into channels (type, created_by) values ('dm', my) returning id into ch;
    insert into channel_members (channel_id, employee_id) values (ch, my), (ch, other);
  end if;
  return ch;
end $$;

-- the other person in one of my DMs (lets an employee see the admin who messaged them)
create or replace function dm_peer(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from channel_members a
    join channel_members b on b.channel_id = a.channel_id and b.employee_id = (select id from me())
    join channels c on c.id = a.channel_id and c.type = 'dm'
    where a.employee_id = emp)
$$;

drop policy if exists dm_peer on employees;
create policy dm_peer on employees for select to authenticated using (role = 'admin' and dm_peer(id));
