-- Admins can read (not post in) every group, department and office channel. DMs stay private to their two people.
-- Admins already see the channel rows (channels.read policy); this opens the messages and their call history.
drop policy if exists admin_read on messages;
create policy admin_read on messages for select to authenticated
  using (is_admin() and exists (select 1 from channels c where c.id = channel_id and c.type <> 'dm'));
drop policy if exists admin_read on calls;
create policy admin_read on calls for select to authenticated
  using (is_admin() and exists (select 1 from channels c where c.id = channel_id and c.type <> 'dm'));
