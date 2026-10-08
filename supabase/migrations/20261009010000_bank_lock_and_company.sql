-- Onboarding: which company they work with; alias + email for each one picked (app enforces).
alter table employee_profiles
  add column if not exists company      text check (company in ('lgoob', 'fusion', 'both')),
  add column if not exists lgoob_alias  text check (length(lgoob_alias) <= 60),
  add column if not exists lgoob_email  text check (length(lgoob_email) <= 254),
  add column if not exists fusion_alias text check (length(fusion_alias) <= 60),
  add column if not exists fusion_email text check (length(fusion_email) <= 254);

-- Bank details: employee can change their own only after HR/admin unlocks; every save locks again.
alter table employee_bank
  add column if not exists employee_can_edit boolean not null default false,
  add column if not exists edit_requested_at timestamptz;

create or replace function save_bank_details(p_emp uuid, p_holder text, p_account text, p_ifsc text, p_bank text, p_pan text default null, p_uan text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_see_pay(p_emp) then raise exception 'Not allowed'; end if;
  if p_emp = (select id from me()) and exists (select 1 from employee_bank where employee_id = p_emp and not employee_can_edit) then
    raise exception 'Bank details are locked. Ask HR or an admin to allow editing.';
  end if;
  insert into employee_bank (employee_id, holder_name, account_number, ifsc, bank_name, pan, uan)
  values (p_emp, trim(p_holder), trim(p_account), upper(trim(p_ifsc)), trim(p_bank), nullif(upper(trim(p_pan)), ''), nullif(trim(p_uan), ''))
  on conflict (employee_id) do update set holder_name = excluded.holder_name, account_number = excluded.account_number,
    ifsc = excluded.ifsc, bank_name = excluded.bank_name, pan = excluded.pan, uan = excluded.uan,
    employee_can_edit = false, edit_requested_at = null, updated_at = now();
end $$;

-- employee asks HR/admin to unlock their own bank details
create or replace function request_bank_edit() returns void
language plpgsql security definer set search_path = public as $$
begin
  update employee_bank set edit_requested_at = now() where employee_id = (select id from me()) and not employee_can_edit;
  if not found then raise exception 'Nothing to request'; end if;
end $$;

-- HR (own office) / admin unlocks one save of someone else's bank details
create or replace function allow_bank_edit(p_emp uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_emp = (select id from me()) or not can_see_pay(p_emp) then raise exception 'Not allowed'; end if;
  update employee_bank set employee_can_edit = true, edit_requested_at = null where employee_id = p_emp;
end $$;
