-- Remove a direct-message chat from MY list only. Messages stay (the other person still has them, admins can still audit).
-- The chat comes back on its own when a newer message arrives, or when I open the person again (dm_with).

alter table channel_members add column hidden_at timestamptz;

create function hide_dm(p_channel uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update channel_members set hidden_at = now()
  where channel_id = p_channel and employee_id = (select id from me())
    and exists (select 1 from channels where id = p_channel and type = 'dm');
  if not found then raise exception 'Not one of your direct messages'; end if;
end $$;

-- opening the person again (directory, new conversation) brings the chat back
create or replace function dm_with(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  my uuid := (select id from me());
  ch uuid;
begin
  if my is null then raise exception 'Not an active employee'; end if;
  if other = my then raise exception 'Cannot DM yourself'; end if;
  if not exists (select 1 from employees where id = other and active) then raise exception 'Unknown employee'; end if;
  select a.channel_id into ch
  from channel_members a
  join channel_members b on b.channel_id = a.channel_id and b.employee_id = other
  join channels c on c.id = a.channel_id and c.type = 'dm'
  where a.employee_id = my
  limit 1;
  if ch is null then
    if not is_admin() and exists (select 1 from employees where id = other and role = 'admin') then
      raise exception 'Admins can''t be messaged directly. Use Report an issue instead.';
    end if;
    insert into channels (type, created_by) values ('dm', my) returning id into ch;
    insert into channel_members (channel_id, employee_id) values (ch, my), (ch, other);
  else
    update channel_members set hidden_at = null where channel_id = ch and employee_id = my;
  end if;
  return ch;
end $$;

-- my_channels(): a removed DM stays out of the list until a message newer than the removal exists
create or replace function my_channels()
returns table (id uuid, type channel_type, name text, unread bigint, last_at timestamptz, announcements boolean, avatar_url text, office_id uuid, office_name text, peer_id uuid)
language sql stable set search_path = public as $$
  select c.id, c.type,
    case when c.type = 'dm' then (
      select e.full_name from channel_members cm join employees e on e.id = cm.employee_id
      where cm.channel_id = c.id and cm.employee_id <> (select id from me()) limit 1)
    else c.name end,
    (select count(*) from messages m
     where m.channel_id = c.id and m.created_at > coalesce(mine.last_read_at, '-infinity')
       and m.sender_id is distinct from (select id from me())),
    (select max(m.created_at) from messages m where m.channel_id = c.id),
    c.announcements,
    case when c.type = 'dm' then (
      select e.avatar_url from channel_members cm join employees e on e.id = cm.employee_id
      where cm.channel_id = c.id and cm.employee_id <> (select id from me()) limit 1)
    end,
    o.id, o.name,
    case when c.type = 'dm' then (
      select cm.employee_id from channel_members cm
      where cm.channel_id = c.id and cm.employee_id <> (select id from me()) limit 1)
    end
  from channels c
  left join departments d on d.id = c.department_id
  left join offices o on o.id = coalesce(c.office_id, d.office_id)
  left join channel_members mine on mine.channel_id = c.id and mine.employee_id = (select id from me())
  where is_member(c.id)
    and not (c.type = 'dm' and mine.hidden_at is not null
             and coalesce((select max(m.created_at) from messages m where m.channel_id = c.id), '-infinity') <= mine.hidden_at)
  order by 6 desc, 5 desc nulls last, 3
$$;
