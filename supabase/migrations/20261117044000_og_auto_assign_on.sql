-- Turn on automatic OG numbers for new sign-ups.
-- The next number is the lowest free value from 5 to 100.
-- 4 stays reserved and is never chosen automatically.
-- Existing profiles are not numbered by this change.

create table if not exists public.og_reserved (
  og_number smallint primary key,
  constraint og_reserved_range check (og_number >= 1 and og_number <= 100)
);

alter table public.og_reserved enable row level security;

revoke all on table public.og_reserved from anon, authenticated;

insert into public.og_reserved (og_number)
values (4)
on conflict (og_number) do nothing;

comment on table public.og_reserved is
  'OG numbers that automatic signup assignment must never use.';

create or replace function public.assign_og_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_n integer;
  caller text;
  auto_on boolean;
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
  select enabled into auto_on
  from public.site_flags
  where name = 'og_auto_assign';
  if coalesce(auto_on, false) is not true then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('imdrivn_og_number'));
  select n into next_n
  from generate_series(5, 100) as n
  where not exists (
    select 1 from public.og_reserved as reserved
    where reserved.og_number = n
  )
  and not exists (
    select 1 from public.profiles as taken
    where taken.og_number = n
  )
  order by n
  limit 1;
  if next_n is not null then
    new.og_number := next_n;
  end if;
  return new;
end;
$$;

update public.site_flags
set enabled = true
where name = 'og_auto_assign';

comment on column public.profiles.og_number is
  'OG member number 1 to 100. 4 is reserved for a later manual assignment. New sign-ups take the lowest free number from 5 upward while og_auto_assign is on.';
