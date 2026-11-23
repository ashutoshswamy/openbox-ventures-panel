alter table employee_documents drop constraint employee_documents_category_check;
alter table employee_documents add constraint employee_documents_category_check
  check (category in ('offer_letter', 'contract', 'id_proof', 'address_proof', 'certificate', 'tax', 'other', 'aadhaar', 'pan'));
