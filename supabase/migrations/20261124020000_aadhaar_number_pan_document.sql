-- Aadhaar number beside PAN; PAN gets its own document slot again (Aadhaar already has one).
alter table employee_bank add column if not exists aadhaar text check (aadhaar ~ '^[0-9]{12}$');

alter table employee_documents drop constraint employee_documents_category_check;
alter table employee_documents add constraint employee_documents_category_check
  check (category in ('offer_letter', 'contract', 'id_proof', 'address_proof', 'certificate', 'tax', 'other', 'aadhaar', 'pan'));

drop function if exists save_bank_details(uuid, text, text, text, text, text, text);
create function save_bank_details(p_emp uuid, p_holder text, p_account text, p_ifsc text, p_bank text, p_pan text default null, p_uan text default null, p_aadhaar text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_see_pay(p_emp) then raise exception 'Not allowed'; end if;
  if p_emp = (select id from me()) and exists (select 1 from employee_bank where employee_id = p_emp and not employee_can_edit) then
    raise exception 'Bank details are locked. Ask HR or an admin to allow editing.';
  end if;
  insert into employee_bank (employee_id, holder_name, account_number, ifsc, bank_name, pan, uan, aadhaar)
  values (p_emp, trim(p_holder), trim(p_account), upper(trim(p_ifsc)), trim(p_bank), nullif(upper(trim(p_pan)), ''), nullif(trim(p_uan), ''), nullif(regexp_replace(p_aadhaar, '[\s-]', '', 'g'), ''))
  on conflict (employee_id) do update set holder_name = excluded.holder_name, account_number = excluded.account_number,
    ifsc = excluded.ifsc, bank_name = excluded.bank_name, pan = excluded.pan, uan = excluded.uan, aadhaar = excluded.aadhaar,
    employee_can_edit = false, edit_requested_at = null, updated_at = now();
end $$;
grant execute on function save_bank_details(uuid, text, text, text, text, text, text, text) to authenticated;

-- audit log masks bank values: add aadhaar to the secret list
do $$
declare src text;
begin
  select pg_get_functiondef('audit()'::regprocedure) into src;
  execute replace(src, '''pan'', ''uan''', '''pan'', ''uan'', ''aadhaar''');
end $$;
