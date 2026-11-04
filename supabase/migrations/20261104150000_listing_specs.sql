-- One spec set for every category: transmission, induction, rego, and VIN.
-- Old turbo / supercharged flags stay in the table. Induction is what the ad shows.

alter table public.listings
  add column if not exists transmission text,
  add column if not exists induction text,
  add column if not exists rego text,
  add column if not exists vin text;

update public.listings
set induction = case
  when turbo is true then 'Turbo'
  when supercharged is true then 'Supercharged'
  else 'N/A'
end
where induction is null;

alter table public.listings
  alter column induction set default 'N/A';

alter table public.listings
  alter column induction set not null;

alter table public.listings drop constraint if exists listings_transmission_check;
alter table public.listings
  add constraint listings_transmission_check
  check (transmission is null or transmission in ('Auto', 'Manual'));

alter table public.listings drop constraint if exists listings_induction_check;
alter table public.listings
  add constraint listings_induction_check
  check (induction in ('N/A', 'Turbo', 'Supercharged'));

alter table public.listings drop constraint if exists listings_rego_len;
alter table public.listings
  add constraint listings_rego_len
  check (rego is null or char_length(rego) <= 12);

alter table public.listings drop constraint if exists listings_vin_len;
alter table public.listings
  add constraint listings_vin_len
  check (vin is null or char_length(vin) <= 17);

create table if not exists public.vin_requests (
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, buyer_id)
);

alter table public.vin_requests enable row level security;

revoke all on public.vin_requests from public, anon, authenticated;
grant select, insert, delete on public.vin_requests to authenticated;

drop policy if exists vin_requests_read_own on public.vin_requests;
create policy vin_requests_read_own
  on public.vin_requests
  for select
  to authenticated
  using (buyer_id = auth.uid());

drop policy if exists vin_requests_insert_own on public.vin_requests;
create policy vin_requests_insert_own
  on public.vin_requests
  for insert
  to authenticated
  with check (buyer_id = auth.uid());

drop policy if exists vin_requests_delete_own on public.vin_requests;
create policy vin_requests_delete_own
  on public.vin_requests
  for delete
  to authenticated
  using (buyer_id = auth.uid());
