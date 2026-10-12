-- HR can add members to existing group chats (admins already could). HR sees a group's name and member list, never its messages.
drop policy if exists hr_read on channels;
create policy hr_read on channels for select to authenticated
  using (my_role() = 'hr' and (select id from me()) is not null and type = 'group' and not announcements);
drop policy if exists hr_read on channel_members;
create policy hr_read on channel_members for select to authenticated
  using (my_role() = 'hr' and (select id from me()) is not null and exists (select 1 from channels c where c.id = channel_id and c.type = 'group' and not c.announcements));

drop policy if exists add on channel_members;
create policy add on channel_members for insert to authenticated with check (
  (is_admin() or exists (select 1 from channels c where c.id = channel_id and c.type = 'group'
     and (c.created_by = (select id from me()) or (my_role() = 'hr' and (select id from me()) is not null and not c.announcements))))
  and exists (select 1 from employees e where e.id = employee_id and e.role is distinct from 'admin') -- admins aren't chat members (and are invisible to non-admins)
);
