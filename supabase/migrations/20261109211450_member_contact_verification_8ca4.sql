-- IM DRIVN: member verification tick (verified email + phone provided).
-- Server-derived badge: public.profiles.member_verified is true only when
--   * auth.users.email is set, email_confirmed_at is set (current email confirmed by Supabase Auth),
--     the user is not anonymous and not soft-deleted, AND
--   * a valid phone number has been supplied in the private self-only store private.member_contacts.
-- The phone is NOT SMS-verified; the tick does not mean identity checked.
-- Legacy public.profiles.verified is left untouched (unused, client-writable; do not render it).

-- 1. Private, self-only phone store (private schema is not exposed by the Data API).
create table if not exists private.member_contacts (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table private.member_contacts is
  'Account phone supplied by the member (not SMS-verified). Self-only via public.get_my_account_settings / set_my_phone / clear_my_phone.';
alter table private.member_contacts enable row level security; -- no policies: definer functions only
revoke all on table private.member_contacts from public, anon, authenticated;

-- 2. Public, server-maintained badge column.
alter table public.profiles
  add column if not exists member_verified boolean not null default false;
comment on column public.profiles.member_verified is
  'Server-derived: current email confirmed + phone supplied (phone not SMS-verified). Clients cannot set it.';

-- 3. Phone normaliser (AU numbers -> +61..., otherwise E.164). Returns null when invalid.
create or replace function private.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text;
begin
  if p_phone is null or length(p_phone) > 40 then
    return null;
  end if;
  s := regexp_replace(btrim(p_phone), '[[:space:]().-]', '', 'g');
  if s ~ '^00[1-9]' then
    s := '+' || substr(s, 3);
  end if;
  if s ~ '^0[2-478][0-9]{8}$' then
    return '+61' || substr(s, 2);
  end if;
  if s ~ '^61[2-478][0-9]{8}$' then
    return '+' || s;
  end if;
  if s ~ '^\+610[2-478][0-9]{8}$' then
    return '+61' || substr(s, 5);
  end if;
  if s ~ '^\+61' then
    return case when s ~ '^\+61[2-478][0-9]{8}$' then s end;
  end if;
  if s ~ '^\+[1-9][0-9]{7,14}$' then
    return s;
  end if;
  return null;
end;
$$;

-- 4. Eligibility (reads auth.users + private store).
create or replace function private.compute_member_verified(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
      select nullif(btrim(u.email), '') is not null
         and u.email_confirmed_at is not null
         and not coalesce(u.is_anonymous, false)
         and u.deleted_at is null
      from auth.users u
      where u.id = p_user
    ), false)
    and exists (
      select 1 from private.member_contacts c
      where c.user_id = p_user
        and c.phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
    );
$$;

create or replace function private.refresh_member_verified(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v boolean := private.compute_member_verified(p_user);
begin
  update public.profiles p
     set member_verified = v
   where p.id = p_user
     and p.member_verified is distinct from v;
  return v;
end;
$$;

-- 5. Guard: any insert, or any update that touches member_verified, gets the server value.
create or replace function private.profiles_member_verified_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.member_verified := private.compute_member_verified(new.id);
  return new;
end;
$$;

drop trigger if exists profiles_member_verified_guard on public.profiles;
create trigger profiles_member_verified_guard
  before insert or update of member_verified on public.profiles
  for each row execute function private.profiles_member_verified_guard();

-- 6. Recompute when the private phone store changes.
create or replace function private.on_member_contacts_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_member_verified(coalesce(new.user_id, old.user_id));
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    perform private.refresh_member_verified(old.user_id);
  end if;
  return null;
end;
$$;

drop trigger if exists member_contacts_refresh_badge on private.member_contacts;
create trigger member_contacts_refresh_badge
  after insert or update or delete on private.member_contacts
  for each row execute function private.on_member_contacts_change();

-- 7. Recompute when Supabase Auth confirms/changes the email (never blocks Auth).
create or replace function private.on_auth_user_member_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_member_verified(new.id);
  return new;
exception when others then
  raise warning 'on_auth_user_member_verified failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_member_verified on auth.users;
create trigger on_auth_user_member_verified
  after update of email, email_confirmed_at, is_anonymous, deleted_at on auth.users
  for each row
  when (old.email is distinct from new.email
     or old.email_confirmed_at is distinct from new.email_confirmed_at
     or old.is_anonymous is distinct from new.is_anonymous
     or old.deleted_at is distinct from new.deleted_at)
  execute function private.on_auth_user_member_verified();

-- 8. Self-only account settings RPCs (definer in private, invoker wrappers in public).
create or replace function private.get_my_account_settings()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed boolean := false;
  v_pending text;
  v_phone text;
  v_verified boolean;
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  select nullif(btrim(u.email), ''),
         nullif(btrim(u.email), '') is not null and u.email_confirmed_at is not null,
         nullif(btrim(u.email_change), '')
    into v_email, v_confirmed, v_pending
    from auth.users u
   where u.id = v_uid;
  select c.phone_e164 into v_phone from private.member_contacts c where c.user_id = v_uid;
  v_verified := private.refresh_member_verified(v_uid); -- also self-heals the stored badge
  return jsonb_build_object(
    'email', v_email,
    'email_confirmed', coalesce(v_confirmed, false),
    'pending_email', v_pending,
    'phone', v_phone,
    'phone_provided', v_phone is not null,
    'member_verified', v_verified,
    'missing', to_jsonb(array_remove(array[
        case when not coalesce(v_confirmed, false) then 'verified_email' end,
        case when v_phone is null then 'phone' end
      ], null))
  );
end;
$$;

create or replace function private.set_my_phone(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_norm text;
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  v_norm := private.normalize_phone(p_phone);
  if v_norm is null then
    raise exception 'Enter a valid phone number, like 0412 345 678 or +61 412 345 678.'
      using errcode = '22023';
  end if;
  insert into private.member_contacts as c (user_id, phone_e164)
  values (v_uid, v_norm)
  on conflict (user_id) do update
    set phone_e164 = excluded.phone_e164, updated_at = now()
    where c.phone_e164 is distinct from excluded.phone_e164;
  return private.get_my_account_settings();
end;
$$;

create or replace function private.clear_my_phone()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  delete from private.member_contacts where user_id = v_uid;
  return private.get_my_account_settings();
end;
$$;

create or replace function public.get_my_account_settings()
returns jsonb language sql security invoker set search_path = ''
as $$ select private.get_my_account_settings(); $$;

create or replace function public.set_my_phone(p_phone text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.set_my_phone(p_phone); $$;

create or replace function public.clear_my_phone()
returns jsonb language sql security invoker set search_path = ''
as $$ select private.clear_my_phone(); $$;

-- 9. Grants: nothing for anon; authenticated may only execute the three entry points.
revoke all on function private.normalize_phone(text) from public, anon, authenticated;
revoke all on function private.compute_member_verified(uuid) from public, anon, authenticated;
revoke all on function private.refresh_member_verified(uuid) from public, anon, authenticated;
revoke all on function private.profiles_member_verified_guard() from public, anon, authenticated;
revoke all on function private.on_member_contacts_change() from public, anon, authenticated;
revoke all on function private.on_auth_user_member_verified() from public, anon, authenticated;
revoke all on function private.get_my_account_settings() from public, anon, authenticated;
revoke all on function private.set_my_phone(text) from public, anon, authenticated;
revoke all on function private.clear_my_phone() from public, anon, authenticated;
revoke all on function public.get_my_account_settings() from public, anon, authenticated;
revoke all on function public.set_my_phone(text) from public, anon, authenticated;
revoke all on function public.clear_my_phone() from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.get_my_account_settings() to authenticated;
grant execute on function private.set_my_phone(text) to authenticated;
grant execute on function private.clear_my_phone() to authenticated;
grant execute on function public.get_my_account_settings() to authenticated;
grant execute on function public.set_my_phone(text) to authenticated;
grant execute on function public.clear_my_phone() to authenticated;

-- Future private functions should not default to PUBLIC execute now that authenticated has schema usage.
alter default privileges in schema private revoke execute on functions from public;
