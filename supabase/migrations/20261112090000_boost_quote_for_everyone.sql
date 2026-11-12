-- Free boosts are one per rolling 7 days for every signed-in user.
-- Membership stays optional. Paid boosts are recorded separately.

drop policy if exists listing_boosts_select_own on public.listing_boosts;
create policy listing_boosts_select_own
  on public.listing_boosts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on table public.listing_boosts to authenticated;

create or replace function public.boost_quote(p_listing_id uuid)
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
  select max(b.created_at) into v_last
  from public.listing_boosts b
  where b.user_id = v_uid and b.kind = 'free';
  if v_last is not null and v_last > now() - interval '7 days' then
    return jsonb_build_object('free', false, 'next_free_at', v_last + interval '7 days');
  end if;
  return jsonb_build_object('free', true);
end;
$function$;

revoke all on function public.boost_quote(uuid) from public;
grant execute on function public.boost_quote(uuid) to authenticated, service_role;

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
  select max(b.created_at) into v_last
  from public.listing_boosts b
  where b.user_id = v_uid and b.kind = 'free';
  if v_last is not null and v_last > now() - interval '7 days' then
    v_next := v_last + interval '7 days';
    return jsonb_build_object('ok', false, 'reason', 'wait', 'next_free_at', v_next);
  end if;
  perform set_config('app.allow_boost', 'on', true);
  update public.listings
    set bumped_at = now()
    where id = p_listing_id;
  insert into public.listing_boosts (listing_id, user_id, kind)
  values (p_listing_id, v_uid, 'free');
  return jsonb_build_object('ok', true, 'next_free_at', now() + interval '7 days');
end;
$function$;
