-- Calls in the company-wide General chat are allowed (it rings everyone). Admins can also start / join / end calls in any
-- group, department or office chat, not only chats they are members of (they already read and post in all of them).
-- Still no calls in Announcements or other people's DMs.
create or replace function start_call(ch uuid, p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare
  my uuid := (select id from me());
  c uuid;
begin
  if my is null
     or not (is_member(ch) or (is_admin() and exists (select 1 from channels where id = ch and type <> 'dm')))
     or exists (select 1 from channels where id = ch and announcements) then
    raise exception 'Not allowed';
  end if;
  insert into calls (channel_id, room, started_by) values (ch, p_room, my) returning id into c;
  insert into call_participants (call_id, employee_id) values (c, my);
end $$;

create or replace function call_ping(p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare
  my uuid := (select id from me());
  c calls;
begin
  select * into c from calls where room = p_room;
  if my is null or c.id is null or not (is_member(c.channel_id) or is_admin()) then raise exception 'Not allowed'; end if;
  if c.ended_at is not null then return; end if;
  insert into call_participants (call_id, employee_id) values (c.id, my)
  on conflict (call_id, employee_id) do update set last_seen_at = now();
end $$;

create or replace function end_call(p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c calls;
begin
  select * into c from calls where room = p_room;
  if (select id from me()) is null or c.id is null or not (is_member(c.channel_id) or is_admin()) then raise exception 'Not allowed'; end if;
  update calls set ended_at = now() where id = c.id and ended_at is null;
end $$;
