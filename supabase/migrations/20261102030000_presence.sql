-- Online / idle / do-not-disturb. Server-side heartbeat instead of client-chosen Realtime Presence keys,
-- so nobody can show up as (or fake the status of) someone else: rows are only written for me() by presence_ping().
-- One row per browser tab; a person's status = strongest of their live tabs; no heartbeat for 2 min = offline (background tabs ping about once a minute).

create unlogged table presence (
  employee_id uuid not null references employees on delete cascade,
  tab         text not null check (length(tab) between 8 and 40),
  status      text not null check (status in ('online', 'idle', 'dnd')),
  seen        timestamptz not null default now(),
  primary key (employee_id, tab)
);
alter table presence enable row level security; -- no policies: only the functions below touch it
revoke all on presence from anon, authenticated;

create function presence_ping(p_tab text, p_status text) returns void
language sql volatile security definer set search_path = public as $$
  insert into presence (employee_id, tab, status)
  select id, p_tab, p_status from me() where id is not null
  on conflict (employee_id, tab) do update set status = excluded.status, seen = now();
  delete from presence where employee_id = (select id from me()) and seen < now() - interval '1 hour'; -- my closed tabs
$$;

create function presence_leave(p_tab text) returns void
language sql volatile security definer set search_path = public as $$
  delete from presence where employee_id = (select id from me()) and tab = p_tab
$$;

create function presence_list() returns table (employee_id uuid, status text)
language sql stable security definer set search_path = public as $$
  select p.employee_id,
    case when bool_or(p.status = 'dnd') then 'dnd' when bool_or(p.status = 'online') then 'online' else 'idle' end
  from presence p
  where p.seen > now() - interval '2 minutes' and (select id from me()) is not null
  group by p.employee_id
$$;

-- an earlier draft used a private Realtime channel; its policies are not needed
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'realtime') then
    execute 'drop policy if exists "employees see presence" on realtime.messages';
    execute 'drop policy if exists "employees announce presence" on realtime.messages';
  end if;
end $$;

-- my_channels() + peer_id: the other person in a DM (status dot next to the conversation)
drop function my_channels();
create function my_channels()
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
    o.id, o.name, -- sidebar nests department channels under their office
    case when c.type = 'dm' then (
      select cm.employee_id from channel_members cm
      where cm.channel_id = c.id and cm.employee_id <> (select id from me()) limit 1)
    end
  from channels c
  left join departments d on d.id = c.department_id
  left join offices o on o.id = coalesce(c.office_id, d.office_id)
  left join channel_members mine on mine.channel_id = c.id and mine.employee_id = (select id from me())
  where is_member(c.id)
  order by 6 desc, 5 desc nulls last, 3
$$;
