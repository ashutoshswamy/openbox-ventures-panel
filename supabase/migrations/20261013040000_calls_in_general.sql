-- Calls allowed in the company-wide chat too (still not in Announcements, which is post-only).
create or replace function start_call(ch uuid, p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare
  my uuid := (select id from me());
  c uuid;
begin
  if my is null or not is_member(ch) or exists (select 1 from channels where id = ch and announcements) then
    raise exception 'Not allowed';
  end if;
  insert into calls (channel_id, room, started_by) values (ch, p_room, my) returning id into c;
  insert into call_participants (call_id, employee_id) values (c, my);
end $$;
