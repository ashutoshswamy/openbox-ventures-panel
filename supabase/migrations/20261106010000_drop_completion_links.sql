-- "Complete your details" is sign-in only now (/complete, no token), so the token table from the previous migration is not needed.
drop table if exists completion_links;
