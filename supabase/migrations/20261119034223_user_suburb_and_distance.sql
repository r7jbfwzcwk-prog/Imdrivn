-- Member suburb for distance sort and radius filter.
-- The suburb is private: stored in private.member_locations and reached only
-- through the authenticated RPCs below. It is not a column on public.profiles.
-- Listing coordinates live on public.listings so IM BUYIN can sort without
-- reading another member's suburb.

create table if not exists private.member_locations (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  suburb     text not null,
  state      text not null,
  postcode   text not null,
  lat        double precision not null,
  lng        double precision not null,
  updated_at timestamptz not null default now()
);
comment on table private.member_locations is
  'Member suburb for distance sort and radius filter. Self-only via public.get_my_location / set_my_location / clear_my_location.';
alter table private.member_locations enable row level security;
revoke all on table private.member_locations from public, anon, authenticated;

alter table public.listings add column if not exists lat double precision;
alter table public.listings add column if not exists lng double precision;
comment on column public.listings.lat is 'Listing suburb latitude. Nullable. Not a member location.';
comment on column public.listings.lng is 'Listing suburb longitude. Nullable. Not a member location.';

create or replace function private.member_location_json(
  p_suburb text,
  p_state text,
  p_postcode text,
  p_lat double precision,
  p_lng double precision,
  p_updated_at timestamptz
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'suburb', p_suburb,
    'state', p_state,
    'postcode', p_postcode,
    'lat', p_lat,
    'lng', p_lng,
    'updated_at', p_updated_at
  );
$$;

create or replace function private.read_member_location(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  loc private.member_locations%rowtype;
begin
  if p_user is null then
    return null;
  end if;
  select * into loc from private.member_locations where user_id = p_user;
  if not found then
    return null;
  end if;
  return private.member_location_json(loc.suburb, loc.state, loc.postcode, loc.lat, loc.lng, loc.updated_at);
end;
$$;

create or replace function private.write_member_location(
  p_user uuid,
  p_suburb text,
  p_state text,
  p_postcode text,
  p_lat double precision,
  p_lng double precision
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  suburb text := btrim(coalesce(p_suburb, ''));
  state text := upper(btrim(coalesce(p_state, '')));
  postcode text := btrim(coalesce(p_postcode, ''));
  saved private.member_locations%rowtype;
begin
  if p_user is null then
    raise exception 'Sign in to save your suburb.';
  end if;
  if suburb = '' or char_length(suburb) > 80 then
    raise exception 'Pick an Australian suburb.';
  end if;
  if state not in ('QLD', 'NSW', 'VIC', 'SA', 'WA', 'NT', 'ACT', 'TAS') then
    raise exception 'Pick an Australian suburb.';
  end if;
  if postcode !~ '^[0-9]{4}$' then
    raise exception 'Pick an Australian suburb.';
  end if;
  if p_lat is null or p_lng is null or p_lat < -45 or p_lat > -9 or p_lng < 96 or p_lng > 160 then
    raise exception 'Pick an Australian suburb.';
  end if;
  insert into private.member_locations (user_id, suburb, state, postcode, lat, lng, updated_at)
  values (p_user, suburb, state, postcode, p_lat, p_lng, now())
  on conflict (user_id) do update
    set suburb = excluded.suburb,
        state = excluded.state,
        postcode = excluded.postcode,
        lat = excluded.lat,
        lng = excluded.lng,
        updated_at = now()
  returning * into saved;
  return private.member_location_json(saved.suburb, saved.state, saved.postcode, saved.lat, saved.lng, saved.updated_at);
end;
$$;

create or replace function private.delete_member_location(p_user uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_user is null then
    return null;
  end if;
  delete from private.member_locations where user_id = p_user;
  return null;
end;
$$;

revoke all on function private.member_location_json(text, text, text, double precision, double precision, timestamptz) from public, anon, authenticated;
revoke all on function private.read_member_location(uuid) from public, anon, authenticated;
revoke all on function private.write_member_location(uuid, text, text, text, double precision, double precision) from public, anon, authenticated;
revoke all on function private.delete_member_location(uuid) from public, anon, authenticated;

create or replace function public.get_my_location()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  return private.read_member_location(auth.uid());
end;
$$;

create or replace function public.set_my_location(
  p_suburb text,
  p_state text,
  p_postcode text,
  p_lat double precision,
  p_lng double precision
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to save your suburb.';
  end if;
  return private.write_member_location(auth.uid(), p_suburb, p_state, p_postcode, p_lat, p_lng);
end;
$$;

create or replace function public.clear_my_location()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  return private.delete_member_location(auth.uid());
end;
$$;

revoke all on function public.get_my_location() from public, anon;
revoke all on function public.set_my_location(text, text, text, double precision, double precision) from public, anon;
revoke all on function public.clear_my_location() from public, anon;
grant execute on function public.get_my_location() to authenticated;
grant execute on function public.set_my_location(text, text, text, double precision, double precision) to authenticated;
grant execute on function public.clear_my_location() to authenticated;
