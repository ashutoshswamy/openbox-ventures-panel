-- Reply to a specific message (WhatsApp-style quote). The quoted message must be in the same chat.
-- Everything else about `send` is unchanged. Deleting the original keeps the reply (reply_to → null).
alter table messages add column if not exists reply_to uuid references messages(id) on delete set null;
drop policy if exists send on messages;
create policy send on messages for insert to authenticated with check (
  (is_member(channel_id) or is_admin()) and sender_id = (select id from me())
  and (attachment_path is null or attachment_path like (select id from me())::text || '/%') -- own uploads only
  and (is_admin() or my_role() in ('manager', 'hr') or not exists (select 1 from channels c where c.id = channel_id and c.announcements)) -- admins + managers + HR
  and (messages.reply_to is null or exists (select 1 from messages r where r.id = messages.reply_to and r.channel_id = messages.channel_id))
);
