-- Membership switch ships OFF. Boosts work for free (1 per 7 days) while it is off.

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value)
values ('membership_enabled', 'false'::jsonb)
on conflict (key) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant all on table public.site_settings to service_role;

alter table public.profiles
  add column if not exists membership_status text not null default 'none',
  add column if not exists current_period_end timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create or replace function public.protect_membership_cols()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE'
     and (
       new.membership_status is distinct from old.membership_status
       or new.current_period_end is distinct from old.current_period_end
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     )
     and coalesce(auth.jwt()->>'role', '') <> 'service_role'
     and coalesce(current_setting('app.allow_membership_write', true), '') <> 'on'
  then
    raise exception 'Membership is updated by billing.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_protect_membership on public.profiles;
create trigger profiles_protect_membership
  before update on public.profiles
  for each row
  execute function public.protect_membership_cols();

alter table public.listings
  add column if not exists bumped_at timestamptz;

alter table public.listings
  drop column if exists sort_at;

alter table public.listings
  add column sort_at timestamptz
  generated always as (greatest(created_at, coalesce(bumped_at, created_at))) stored;

create index if not exists listings_sort_at_idx on public.listings (sort_at desc);

create or replace function public.protect_bumped_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE'
     and new.bumped_at is distinct from old.bumped_at
     and coalesce(current_setting('app.allow_boost', true), '') <> 'on'
     and coalesce(auth.jwt()->>'role', '') <> 'service_role'
  then
    raise exception 'Boosts are applied by the server.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists listings_protect_bumped_at on public.listings;
create trigger listings_protect_bumped_at
  before update on public.listings
  for each row
  execute function public.protect_bumped_at();

create table if not exists public.listing_boosts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('free', 'paid')),
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists listing_boosts_user_free_idx
  on public.listing_boosts (user_id, created_at desc)
  where kind = 'free';

alter table public.listing_boosts enable row level security;
revoke all on table public.listing_boosts from anon, authenticated;
grant all on table public.listing_boosts to service_role;

create or replace function public.membership_enabled()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((
    select s.value = 'true'::jsonb
    from public.site_settings s
    where s.key = 'membership_enabled'
  ), false);
$function$;

revoke all on function public.membership_enabled() from public;
grant execute on function public.membership_enabled() to anon, authenticated, service_role;

create or replace function public.member_is_active(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((
    select p.membership_status in ('active', 'trialing')
    from public.profiles p
    where p.id = p_user
  ), false);
$function$;

revoke all on function public.member_is_active(uuid) from public;
grant execute on function public.member_is_active(uuid) to anon, authenticated, service_role;

create or replace function public.set_membership_enabled(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  update public.site_settings
    set value = to_jsonb(coalesce(p_enabled, false)),
        updated_at = now()
    where key = 'membership_enabled';
  return public.membership_enabled();
end;
$function$;

revoke all on function public.set_membership_enabled(boolean) from public;
grant execute on function public.set_membership_enabled(boolean) to authenticated, service_role;

create or replace function public.require_member()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid;
begin
  if not public.membership_enabled() then
    return new;
  end if;
  v_user := coalesce(new.user_id, new.author_id);
  if public.member_is_active(v_user) then
    return new;
  end if;
  raise exception 'An active membership is required.'
    using errcode = 'P0001';
end;
$function$;

drop trigger if exists listings_require_member on public.listings;
create trigger listings_require_member
  before insert on public.listings
  for each row
  execute function public.require_member();

drop trigger if exists forum_threads_require_member on public.forum_threads;
create trigger forum_threads_require_member
  before insert on public.forum_threads
  for each row
  execute function public.require_member();

drop trigger if exists forum_replies_require_member on public.forum_replies;
create trigger forum_replies_require_member
  before insert on public.forum_replies
  for each row
  execute function public.require_member();

create or replace function public.boost_listing(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_last timestamptz;
  v_next timestamptz;
  v_paid boolean;
begin
  if v_uid is null then
    raise exception 'Sign in to boost a car.' using errcode = '42501';
  end if;
  select l.user_id, l.status into v_owner, v_status
  from public.listings l
  where l.id = p_listing_id;
  if v_owner is null or v_owner <> v_uid or v_status <> 'active' then
    raise exception 'You can only boost your own live ad.' using errcode = '42501';
  end if;
  v_paid := public.membership_enabled();
  if v_paid and not public.member_is_active(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'member', 'paid', false);
  end if;
  select max(b.created_at) into v_last
  from public.listing_boosts b
  where b.user_id = v_uid and b.kind = 'free';
  if v_last is not null and v_last > now() - interval '7 days' then
    v_next := v_last + interval '7 days';
    return jsonb_build_object(
      'ok', false,
      'reason', 'wait',
      'paid', v_paid,
      'next_free_at', v_next
    );
  end if;
  perform set_config('app.allow_boost', 'on', true);
  update public.listings
    set bumped_at = now()
    where id = p_listing_id;
  insert into public.listing_boosts (listing_id, user_id, kind)
  values (p_listing_id, v_uid, 'free');
  return jsonb_build_object(
    'ok', true,
    'paid', false,
    'next_free_at', now() + interval '7 days'
  );
end;
$function$;

revoke all on function public.boost_listing(uuid) from public;
grant execute on function public.boost_listing(uuid) to authenticated, service_role;

create or replace function public.apply_paid_boost(
  p_listing_id uuid,
  p_user_id uuid,
  p_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_owner uuid;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Billing only.' using errcode = '42501';
  end if;
  if p_session_id is null or btrim(p_session_id) = '' then
    raise exception 'Missing payment.' using errcode = '22023';
  end if;
  if exists (select 1 from public.listing_boosts b where b.stripe_session_id = p_session_id) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  select l.user_id into v_owner from public.listings l where l.id = p_listing_id and l.status = 'active';
  if v_owner is null or v_owner <> p_user_id then
    raise exception 'That ad cannot be boosted.' using errcode = '22023';
  end if;
  perform set_config('app.allow_boost', 'on', true);
  update public.listings set bumped_at = now() where id = p_listing_id;
  insert into public.listing_boosts (listing_id, user_id, kind, stripe_session_id)
  values (p_listing_id, p_user_id, 'paid', p_session_id);
  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.apply_paid_boost(uuid, uuid, text) from public;
grant execute on function public.apply_paid_boost(uuid, uuid, text) to service_role;
