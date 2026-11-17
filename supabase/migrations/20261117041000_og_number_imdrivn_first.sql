-- OG #1 is the official IMDRIVN admin. Other accounts that have a
-- username follow in created_at order. New profiles still receive the
-- next free number, up to 100. Signed-in users cannot change the number.
-- Service role and the database owner can.

drop trigger if exists profiles_assign_og_number on public.profiles;

update public.profiles set og_number = null;

update public.profiles
set og_number = 1
where is_admin is true
  and lower(username) = 'imdrivn';

with ranked as (
  select id, row_number() over (order by created_at asc, id asc) + 1 as n
  from public.profiles
  where username is not null
    and og_number is distinct from 1
)
update public.profiles as p
set og_number = ranked.n
from ranked
where p.id = ranked.id
  and ranked.n <= 100;

create or replace function public.assign_og_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_n integer;
  caller text;
begin
  caller := coalesce(auth.role(), '');
  if tg_op = 'UPDATE' then
    if caller in ('anon', 'authenticated') then
      new.og_number := old.og_number;
    end if;
    return new;
  end if;
  if caller in ('anon', 'authenticated') then
    new.og_number := null;
  end if;
  if new.og_number is not null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('imdrivn_og_number'));
  select coalesce(max(og_number), 0) + 1 into next_n
  from public.profiles
  where og_number is not null;
  if next_n <= 100 then
    new.og_number := next_n;
  end if;
  return new;
end;
$$;

create trigger profiles_assign_og_number
  before insert or update of og_number on public.profiles
  for each row
  execute function public.assign_og_number();

comment on column public.profiles.og_number is
  'OG member number. 1 is the official IMDRIVN account. Later numbers follow created_at, up to 100.';
