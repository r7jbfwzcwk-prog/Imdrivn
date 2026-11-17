-- First 100 accounts, by profile created_at, are OG members #1 to #100.
-- The number is assigned by the database and cannot be edited from the client.

alter table public.profiles
  add column if not exists og_number smallint;

alter table public.profiles
  drop constraint if exists profiles_og_number_range;

alter table public.profiles
  add constraint profiles_og_number_range
  check (og_number is null or (og_number >= 1 and og_number <= 100));

create unique index if not exists profiles_og_number_key
  on public.profiles (og_number)
  where og_number is not null;

comment on column public.profiles.og_number is
  'OG member number 1 to 100, in created_at order. Null after the first 100 accounts.';

with ranked as (
  select id, row_number() over (order by created_at asc, id asc) as n
  from public.profiles
)
update public.profiles as p
set og_number = ranked.n
from ranked
where p.id = ranked.id
  and ranked.n <= 100
  and p.og_number is null;

create or replace function public.assign_og_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_n integer;
begin
  if tg_op = 'UPDATE' then
    new.og_number := old.og_number;
    return new;
  end if;
  new.og_number := null;
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

drop trigger if exists profiles_assign_og_number on public.profiles;
create trigger profiles_assign_og_number
  before insert or update of og_number on public.profiles
  for each row
  execute function public.assign_og_number();

create or replace function public.og_for(uid uuid)
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select og_number from public.profiles where id = uid;
$$;

comment on function public.og_for(uuid) is
  'OG member number for one account, or null. Does not return any other profile fields.';

revoke all on function public.og_for(uuid) from public;
grant execute on function public.og_for(uuid) to anon, authenticated;
