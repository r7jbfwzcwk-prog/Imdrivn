-- One-time post-sign-up welcome. Existing profiles are marked seen so they never
-- see the page. Accounts created after this stay null until the page is shown.

alter table public.profiles
  add column if not exists welcomed_at timestamptz;

comment on column public.profiles.welcomed_at is
  'When this member first saw the welcome page. Null only for accounts created after the column existed.';

create or replace function public.protect_welcomed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.welcomed_at is not null
     and new.welcomed_at is distinct from old.welcomed_at
  then
    new.welcomed_at := old.welcomed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_welcomed_at on public.profiles;
create trigger profiles_protect_welcomed_at
  before update on public.profiles
  for each row
  execute function public.protect_welcomed_at();

update public.profiles
  set welcomed_at = now()
  where welcomed_at is null;
