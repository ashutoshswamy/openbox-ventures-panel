-- Emoji reactions on chat messages. One row per (message, person, emoji); toggled by the app.
-- Read: whoever can read the message (so admin view-only access follows). React: chat members only.
-- emoji: any (full picker); the length cap fits ZWJ sequences.
create table message_reactions (
  message_id  uuid not null references messages on delete cascade,
  employee_id uuid not null references employees on delete cascade,
  emoji       text not null check (length(emoji) between 1 and 32),
  created_at  timestamptz not null default now(),
  primary key (message_id, employee_id, emoji)
);
alter table message_reactions enable row level security;
create policy read on message_reactions for select to authenticated
  using (exists (select 1 from messages m where m.id = message_id));
create policy add on message_reactions for insert to authenticated with check (
  employee_id = (select id from me())
  and exists (select 1 from messages m where m.id = message_id and is_member(m.channel_id))
);
create policy remove on message_reactions for delete to authenticated using (employee_id = (select id from me()));
revoke update on message_reactions from anon, authenticated;
alter publication supabase_realtime add table message_reactions;
