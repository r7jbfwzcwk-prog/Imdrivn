-- Joe's hand mapping. Only these three accounts have an OG number.
-- imdrivn is 1, hes.buyin is 2, bigrichard is 3.
-- Every other existing profile stays unnumbered.
-- og_auto_assign stays off, so new sign-ups are not numbered yet.

drop trigger if exists profiles_assign_og_number on public.profiles;

update public.profiles
set og_number = null
where id not in (
  select p.id
  from public.profiles as p
  join auth.users as u on u.id = p.id
  where (lower(p.username) = 'imdrivn' and lower(u.email) = 'imdrivn.au@gmail.com')
     or (lower(p.username) = 'hes.buyin' and lower(u.email) = 'rachel_kowitz@hotmail.com')
     or (lower(p.username) = 'bigrichard' and lower(u.email) = 'pro_wiresauto@outlook.com')
);

update public.profiles as p
set og_number = mapped.n
from (
  select p2.id, m.n
  from public.profiles as p2
  join auth.users as u on u.id = p2.id
  join (
    values
      ('imdrivn', 'imdrivn.au@gmail.com', 1),
      ('hes.buyin', 'rachel_kowitz@hotmail.com', 2),
      ('bigrichard', 'pro_wiresauto@outlook.com', 3)
  ) as m(username, email, n)
    on lower(p2.username) = m.username
   and lower(u.email) = m.email
) as mapped
where p.id = mapped.id
  and p.og_number is distinct from mapped.n;

update public.site_flags
set enabled = false
where name = 'og_auto_assign';

create trigger profiles_assign_og_number
  before insert or update of og_number on public.profiles
  for each row
  execute function public.assign_og_number();
