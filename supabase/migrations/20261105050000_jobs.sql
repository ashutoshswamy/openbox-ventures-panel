-- Jobs board: admin/HR post roles, anyone (no login) applies on /careers.
-- Public reads/writes go through the server key in the app; only admin + HR can read or change these tables through the API.

create table jobs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) between 1 and 200),
  department  text check (length(department) <= 100),
  location    text check (length(location) <= 100),
  type        text not null default 'full_time' check (type in ('full_time', 'part_time', 'contract', 'internship')),
  description text not null check (length(trim(description)) between 1 and 10000),
  open        boolean not null default true,
  created_by  uuid references employees on delete set null,
  created_at  timestamptz not null default now()
);
create index on jobs (open, created_at desc);

create table job_applications (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 200),
  email       text not null check (length(email) between 3 and 200),
  phone       text check (length(phone) <= 40),
  note        text check (length(note) <= 3000),
  resume_path text not null,
  status      text not null default 'new' check (status in ('new', 'shortlisted', 'rejected', 'hired')),
  created_at  timestamptz not null default now(),
  unique (job_id, email)
);
create index on job_applications (job_id, created_at desc);

create function can_hire() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('admin', 'hr'), false) and (select id from me()) is not null
$$;

alter table jobs             enable row level security;
alter table job_applications enable row level security;
create policy hire on jobs             for all to authenticated using (can_hire()) with check (can_hire());
create policy hire on job_applications for all to authenticated using (can_hire()) with check (can_hire());
revoke all on jobs, job_applications from anon;
-- applicants are created by the server only; HR/admin change the status, nothing else
revoke insert, update on job_applications from authenticated;
grant update (status) on job_applications to authenticated;

-- private resume bucket: PDF/Word only, 4 MB (stays under the 4.5 MB request cap on Vercel)
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('resumes', 'resumes', false, 4194304, array[
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
    on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
