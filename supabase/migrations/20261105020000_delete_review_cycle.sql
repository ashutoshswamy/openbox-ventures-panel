-- Delete a review cycle together with every review in it (ratings and comments cascade). Same rule as closing: admin, or whoever started it.
create function delete_review_cycle(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from review_cycles
  where id = p_id and (is_admin() or created_by = (select id from me()));
  if not found then raise exception 'Cycle not found or not yours to delete'; end if;
end $$;
