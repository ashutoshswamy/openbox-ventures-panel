-- Admins can post in any chat (group, department, office, DM), not just ones they belong to.
-- Announcements keep their own rule (admins, managers, HR). Everything else about `send` is unchanged.
drop policy if exists send on messages;
create policy send on messages for insert to authenticated with check (
  (is_member(channel_id) or is_admin()) and sender_id = (select id from me())
  and (attachment_path is null or attachment_path like (select id from me())::text || '/%') -- own uploads only
  and (is_admin() or my_role() in ('manager', 'hr') or not exists (select 1 from channels c where c.id = channel_id and c.announcements)) -- admins + managers + HR
);
