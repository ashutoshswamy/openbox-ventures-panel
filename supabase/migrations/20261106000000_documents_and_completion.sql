-- Document vault + "complete your details" links.
-- Both tables are written by the server key only (admin/HR actions, public /complete page).

-- ── Document vault ──
-- Files HR/admin keep for a person (offer letter, ID, contract…). The person reads their own; admin + HR of their office read and manage.
-- Same reach as pay data, so can_see_pay() is the read rule.
create table employee_documents (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees on delete cascade,
  category    text not null check (category in ('offer_letter', 'contract', 'id_proof', 'address_proof', 'certificate', 'tax', 'other')),
  title       text not null check (length(trim(title)) between 1 and 200),
  path        text not null unique,
  expires_on  date,
  uploaded_by uuid references employees on delete set null,
  created_at  timestamptz not null default now()
);
create index on employee_documents (employee_id, created_at desc);

alter table employee_documents enable row level security;
create policy read on employee_documents for select to authenticated using (can_see_pay(employee_id));
revoke all on employee_documents from anon;
revoke insert, update, delete on employee_documents from authenticated;

-- private bucket, 4 MB: uploads go through a server action (Vercel's 4.5 MB request cap), same as resumes
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('documents', 'documents', false, 4194304, array[
      'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
    on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- ── Completion links ──
-- Emailed/shared to someone who hasn't filled in their details or bank account. Only the sha256 of the token is stored.
-- One live link per person (re-sending replaces it); used_at is set on submit.
create table completion_links (
  employee_id uuid primary key references employees on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  uuid references employees on delete set null,
  created_at  timestamptz not null default now()
);
alter table completion_links enable row level security; -- no policies: server key only
revoke all on completion_links from anon, authenticated;
