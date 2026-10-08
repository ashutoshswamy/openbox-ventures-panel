-- Admins can read (not post in) every chat, DMs between employees included. Attachments follow (/files checks message RLS).
-- channel_members on DMs lets the admin see who the two people are.
drop policy if exists admin_read on messages;
create policy admin_read on messages for select to authenticated using (is_admin());
drop policy if exists admin_read on calls;
create policy admin_read on calls for select to authenticated using (is_admin());
drop policy if exists admin_read on channel_members;
create policy admin_read on channel_members for select to authenticated
  using (is_admin() and exists (select 1 from channels c where c.id = channel_id and (c.type = 'dm' or (c.type = 'group' and not c.announcements))));
