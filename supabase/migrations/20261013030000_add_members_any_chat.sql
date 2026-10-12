-- Admins and HR can add people to department and office chats too (not only groups), whatever the person's own
-- department/office. is_member() already counts channel_members rows for every channel type, so no other change.
-- Still out of scope: DMs, announcements and General (everyone is in them already).
-- HR sees these chats' name and member list, never their messages.
drop policy if exists hr_read on channels;
create policy hr_read on channels for select to authenticated
  using (my_role() = 'hr' and (select id from me()) is not null and type in ('group', 'department', 'office') and not announcements);

drop policy if exists hr_read on channel_members;
create policy hr_read on channel_members for select to authenticated
  using (my_role() = 'hr' and (select id from me()) is not null and exists (select 1 from channels c where c.id = channel_id and c.type in ('group', 'department', 'office') and not c.announcements));

-- admins list members of those chats as well (the add-people picker hides who is already in)
drop policy if exists admin_read on channel_members;
create policy admin_read on channel_members for select to authenticated
  using (is_admin() and exists (select 1 from channels c where c.id = channel_id and c.type in ('group', 'department', 'office') and not c.announcements));

drop policy if exists add on channel_members;
create policy add on channel_members for insert to authenticated with check (
  (exists (select 1 from channels c where c.id = channel_id and not c.announcements and (
       (c.type = 'group' and c.created_by = (select id from me()))
    or (c.type in ('group', 'department', 'office') and (is_admin() or (my_role() = 'hr' and (select id from me()) is not null)))))
  )
  and exists (select 1 from employees e where e.id = employee_id and e.role is distinct from 'admin') -- admins aren't chat members (and are invisible to non-admins)
);
