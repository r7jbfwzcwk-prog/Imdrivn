-- Only the official IMDRIVN account keeps an OG number for now.
-- Automatic numbering for new sign-ups is built, and switched off
-- until site_flags.og_auto_assign is turned on. When it is on, a new
-- profile gets the next number above the highest one already stored.

create table if not exists public.site_flags (
  name text primary key,
  enabled boolean not null default false
);

alter table public.site_flags enable row level security;

revoke all on table public.site_flags from anon, authenticated;

insert into public.site_flags (name, enabled)
values ('og_auto_assign', false)
on conflict (name) do update set enabled = false;

comment on table public.site_flags is
  'Server-only switches. Not readable or writable by site visitors.';

drop trigger if exists profiles_assign_og_number on public.profiles;

update public.profiles
set og_number = null
where og_number is distinct from 1
   or lower(coalesce(username, '')) <> 'imdrivn'
   or is_admin is not true;

update public.profiles
set og_number = 1
where is_admin is true
  and lower(username) = 'imdrivn'
  and og_number is distinct from 1;

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
  'OG member number 1 to 100. 1 is the official IMDRIVN account. Further numbers are assigned by hand until og_auto_assign is enabled.';
