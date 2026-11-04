-- Orders for the $10 PPSR report. Payment and the PPSR lookup come later.

create table public.vin_check_orders (
  id uuid primary key default gen_random_uuid(),
  vin text not null check (vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  listing_id uuid references public.listings(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending_payment' check (status = 'pending_payment'),
  created_at timestamptz not null default now()
);

alter table public.vin_check_orders enable row level security;

revoke all on public.vin_check_orders from public, anon, authenticated;
grant insert on public.vin_check_orders to anon, authenticated;
grant select on public.vin_check_orders to authenticated;

create policy vin_check_orders_insert
  on public.vin_check_orders
  for insert
  to anon, authenticated
  with check (
    status = 'pending_payment'
    and (
      (auth.uid() is null and user_id is null)
      or (auth.uid() is not null and user_id = auth.uid())
    )
  );

create policy vin_check_orders_select_own
  on public.vin_check_orders
  for select
  to authenticated
  using (user_id = auth.uid());
