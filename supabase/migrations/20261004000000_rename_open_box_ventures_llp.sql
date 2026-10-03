-- Company name is "Open Box Ventures LLP" (with a space) in the welcome post.
create or replace function announce_joiner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role is null and new.role in ('employee', 'manager') and new.joined_on >= current_date - 14 then
    perform post_announcement(format('Please welcome %s%s%s to Open Box Ventures LLP!', new.full_name,
      coalesce(', ' || new.designation, ''),
      coalesce(' in ' || (select name from departments where id = new.department_id), '')));
  end if;
  return new;
end $$;
