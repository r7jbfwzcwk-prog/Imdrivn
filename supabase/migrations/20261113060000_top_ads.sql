-- Top Ad pins a listing above the IM BUYIN feed until top_until.
-- Only the paid webhook (service role) may set the pin.

alter table public.listings
  add column if not exists top_until timestamptz,
  add column if not exists top_at timestamptz;

create index if not exists listings_top_until_idx
  on public.listings (top_at desc)
  where top_until is not null;

create or replace function public.protect_top_ad()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT'
     and (new.top_until is not null or new.top_at is not null)
     and coalesce(current_setting('app.allow_top', true), '') <> 'on'
     and coalesce(auth.jwt()->>'role', '') <> 'service_role'
  then
    raise exception 'Top Ad is applied by billing.'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE'
     and (
       new.top_until is distinct from old.top_until
       or new.top_at is distinct from old.top_at
     )
     and coalesce(current_setting('app.allow_top', true), '') <> 'on'
     and coalesce(auth.jwt()->>'role', '') <> 'service_role'
  then
    raise exception 'Top Ad is applied by billing.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists listings_protect_top_ad on public.listings;
create trigger listings_protect_top_ad
  before insert or update on public.listings
  for each row
  execute function public.protect_top_ad();

create table if not exists public.listing_tops (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null,
  days integer not null check (days in (3, 5, 7)),
  amount_cents integer not null,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists listing_tops_listing_idx
  on public.listing_tops (listing_id, created_at desc);

alter table public.listing_tops enable row level security;
revoke all on table public.listing_tops from anon, authenticated;
grant all on table public.listing_tops to service_role;

create or replace function public.apply_paid_top(
  p_listing_id uuid,
  p_user_id uuid,
  p_session_id text,
  p_days integer
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_owner uuid;
  v_status text;
  v_until timestamptz;
  v_base timestamptz;
  v_amount integer;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Billing only.' using errcode = '42501';
  end if;
  if p_session_id is null or btrim(p_session_id) = '' then
    raise exception 'Missing payment.' using errcode = '22023';
  end if;
  v_amount := case p_days when 3 then 300 when 5 then 500 when 7 then 600 else 0 end;
  if v_amount = 0 then
    raise exception 'Top Ad is 3, 5, or 7 days.' using errcode = '22023';
  end if;
  if exists (select 1 from public.listing_tops t where t.stripe_session_id = p_session_id) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  select l.user_id, l.status, l.top_until
    into v_owner, v_status, v_until
  from public.listings l
  where l.id = p_listing_id;
  if v_owner is null or v_owner <> p_user_id or v_status <> 'active' then
    raise exception 'That ad cannot be pinned.' using errcode = '22023';
  end if;
  v_base := greatest(coalesce(v_until, now()), now());
  perform set_config('app.allow_top', 'on', true);
  update public.listings
    set top_until = v_base + make_interval(days => p_days),
        top_at = now()
    where id = p_listing_id;
  insert into public.listing_tops (listing_id, user_id, days, amount_cents, stripe_session_id)
  values (p_listing_id, p_user_id, p_days, v_amount, p_session_id);
  return jsonb_build_object('ok', true, 'days', p_days, 'top_until', v_base + make_interval(days => p_days));
end;
$function$;

revoke all on function public.apply_paid_top(uuid, uuid, text, integer) from public;
grant execute on function public.apply_paid_top(uuid, uuid, text, integer) to service_role;
