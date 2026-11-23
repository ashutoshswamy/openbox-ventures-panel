-- Company: add 'entertainment' (collects both LGOOB and Fusion Freights details, like 'both').
alter table employee_profiles drop constraint if exists employee_profiles_company_check;
alter table employee_profiles add constraint employee_profiles_company_check check (company in ('lgoob', 'fusion', 'both', 'entertainment'));
