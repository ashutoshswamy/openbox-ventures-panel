-- Why a record was changed. Set by app code when HR/admin edits someone's personal details; triggers leave it null.
alter table audit_log add column if not exists reason text check (length(reason) <= 500);
