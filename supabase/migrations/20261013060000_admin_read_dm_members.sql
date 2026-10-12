-- 20261013030000 narrowed admin_read on channel_members to group/department/office, which hid who is in each DM
-- (admins' "All direct messages" list showed blank names). Add dm back.
drop policy if exists admin_read on channel_members;
create policy admin_read on channel_members for select to authenticated
  using (is_admin() and exists (select 1 from channels c where c.id = channel_id and c.type in ('dm', 'group', 'department', 'office') and not c.announcements));
