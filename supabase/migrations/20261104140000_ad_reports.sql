-- Ad reports. Reporters can file their own. Only admins can read or update them.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.protect_is_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.is_admin is distinct from old.is_admin
     and not coalesce(old.is_admin, false) then
    raise exception 'Not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_admin on public.profiles;
create trigger profiles_protect_is_admin
  before update on public.profiles
  for each row
  execute function public.protect_is_admin();

update public.profiles set is_admin = true where lower(username) = 'imdrivn';

create table public.ad_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in (
    'Scam/fake listing',
    'Wrong details',
    'Already sold',
    'Offensive content',
    'Other'
  )),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewed')),
  created_at timestamptz not null default now()
);

create unique index ad_reports_one_open
  on public.ad_reports (listing_id, reporter_id)
  where status = 'open';

create index ad_reports_open_idx
  on public.ad_reports (created_at)
  where status = 'open';

alter table public.ad_reports enable row level security;

revoke all on public.ad_reports from public, anon, authenticated;
grant select, insert, update on public.ad_reports to authenticated;

create policy ad_reports_insert_own
  on public.ad_reports
  for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'open'
  );

create policy ad_reports_admin_read
  on public.ad_reports
  for select
  to authenticated
  using (public.is_admin());

create policy ad_reports_admin_update
  on public.ad_reports
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin() and status in ('open', 'reviewed'));

create or replace function public.ad_reports_freeze()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.listing_id is distinct from old.listing_id
     or new.reporter_id is distinct from old.reporter_id
     or new.reason is distinct from old.reason
     or new.details is distinct from old.details
     or new.created_at is distinct from old.created_at
     or new.id is distinct from old.id then
    raise exception 'Only the status can be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists ad_reports_freeze on public.ad_reports;
create trigger ad_reports_freeze
  before update on public.ad_reports
  for each row
  execute function public.ad_reports_freeze();

create policy listings_admin_read
  on public.listings
  for select
  to authenticated
  using (public.is_admin());
