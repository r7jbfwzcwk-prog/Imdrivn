-- VIN report orders move from an unpaid insert to a paid PPSR search.
-- Owners can read their own rows. Writes are service role only.

alter table public.vin_check_orders
  add column if not exists result jsonb,
  add column if not exists search_number text,
  add column if not exists error text,
  add column if not exists rego text,
  add column if not exists plate_state text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.vin_check_orders drop constraint if exists vin_check_orders_status_check;
alter table public.vin_check_orders
  add constraint vin_check_orders_status_check
  check (status = any (array['pending_payment'::text, 'paid'::text, 'searching'::text, 'complete'::text, 'failed'::text, 'expired'::text]));

alter table public.vin_check_orders drop constraint if exists vin_check_orders_plate_state_check;
alter table public.vin_check_orders
  add constraint vin_check_orders_plate_state_check
  check (plate_state is null or plate_state = any (array['NSW'::text, 'VIC'::text, 'QLD'::text, 'WA'::text, 'SA'::text, 'TAS'::text, 'ACT'::text, 'NT'::text]));

drop policy if exists vin_check_orders_insert on public.vin_check_orders;
revoke insert, update, delete on public.vin_check_orders from anon, authenticated;
grant all on public.vin_check_orders to service_role;
