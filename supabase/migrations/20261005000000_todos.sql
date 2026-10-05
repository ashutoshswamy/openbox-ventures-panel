-- To-dos: everyone keeps a personal list; admins (anyone) and managers (own office) assign tasks.
create table todos (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references employees on delete cascade,  -- whose list it's on
  assigned_by uuid references employees on delete set null,          -- null = personal
  title       text not null check (length(title) between 1 and 300),
  due_on      date,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on todos (owner_id, done_at);
create index on todos (assigned_by) where assigned_by is not null;

alter table todos enable row level security;

-- owner sees their list; assigner tracks what they handed out
create policy read on todos for select to authenticated
  using (owner_id = (select id from me()) or assigned_by = (select id from me()));
create policy add on todos for insert to authenticated with check (
  (owner_id = (select id from me()) and assigned_by is null)
  or (assigned_by = (select id from me()) and manages(owner_id))
);
create policy edit on todos for update to authenticated
  using (owner_id = (select id from me()) or assigned_by = (select id from me()))
  with check (owner_id = (select id from me()) or assigned_by = (select id from me()));
-- assignee can't drop an assigned task, only finish it
create policy remove on todos for delete to authenticated
  using ((owner_id = (select id from me()) and assigned_by is null) or assigned_by = (select id from me()));

revoke update on todos from anon, authenticated;
grant update (title, due_on, done_at) on todos to authenticated;
revoke all on todos from anon;

alter publication supabase_realtime add table todos;
