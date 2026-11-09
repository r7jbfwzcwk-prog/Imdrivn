-- REPO RECORD of live applied migration version 20261109211910. Do not reapply.
-- Original upload: 20261110071749_finance_enquiries_backend_d2f9.sql
-- Finance quiz lead capture (IM DRIVN). Persist only; no provider forwarding / email triggers.
-- Guests and signed-in users submit via public.submit_finance_enquiry RPC.
-- Does not touch profiles, auth, or private.member_contacts.

create table if not exists public.finance_enquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  full_name text not null,
  employment_status text not null,
  state text not null,
  mobile text not null,
  email text not null,
  created_at timestamptz not null default now(),
  constraint finance_enquiries_full_name_len
    check (char_length(btrim(full_name)) between 2 and 120),
  constraint finance_enquiries_employment_status_check
    check (employment_status = any (array[
      'Employed Full Time',
      'Employed Part Time',
      'Self Employed / ABN Holder',
      'Casual (More than 6 months)',
      'Casual (Less than 6 months)',
      'Not Currently Working'
    ]::text[])),
  constraint finance_enquiries_state_check
    check (state = any (array['QLD','NSW','VIC','SA','WA','NT','ACT','TAS']::text[])),
  constraint finance_enquiries_email_format
    check (email ~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  constraint finance_enquiries_mobile_format
    check (mobile ~ '^\+?[0-9][0-9[:space:]\-()]{7,24}$')
);

create index if not exists finance_enquiries_created_at_idx
  on public.finance_enquiries (created_at desc);
create index if not exists finance_enquiries_user_id_idx
  on public.finance_enquiries (user_id)
  where user_id is not null;
create index if not exists finance_enquiries_listing_id_idx
  on public.finance_enquiries (listing_id)
  where listing_id is not null;
create index if not exists finance_enquiries_email_lower_idx
  on public.finance_enquiries (lower(email));

comment on table public.finance_enquiries is
  'Finance quiz submissions. PII/employment — not publicly readable. Insert only via submit_finance_enquiry.';

alter table public.finance_enquiries enable row level security;

-- Tighten privileges: no direct client writes; own/admin read only via policies.
revoke all on table public.finance_enquiries from anon, authenticated;
grant select on table public.finance_enquiries to authenticated;
grant all on table public.finance_enquiries to service_role;

drop policy if exists finance_enquiries_select_own on public.finance_enquiries;
create policy finance_enquiries_select_own
  on public.finance_enquiries
  for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- No insert/update/delete policies for anon/authenticated (RPC is the write path).

create or replace function private.submit_finance_enquiry(
  p_full_name text,
  p_employment_status text,
  p_state text,
  p_mobile text,
  p_email text,
  p_listing_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_full_name text;
  v_employment text;
  v_state text;
  v_mobile text;
  v_email text;
  v_digits text;
  v_recent int;
  v_id uuid;
  v_created timestamptz;
begin
  v_full_name := nullif(btrim(coalesce(p_full_name, '')), '');
  v_employment := nullif(btrim(coalesce(p_employment_status, '')), '');
  v_state := upper(nullif(btrim(coalesce(p_state, '')), ''));
  v_mobile := nullif(btrim(coalesce(p_mobile, '')), '');
  v_email := lower(nullif(btrim(coalesce(p_email, '')), ''));

  if v_full_name is null or char_length(v_full_name) < 2 or char_length(v_full_name) > 120 then
    raise exception 'full_name must be between 2 and 120 characters'
      using errcode = '22023';
  end if;

  if v_employment is null or v_employment not in (
    'Employed Full Time',
    'Employed Part Time',
    'Self Employed / ABN Holder',
    'Casual (More than 6 months)',
    'Casual (Less than 6 months)',
    'Not Currently Working'
  ) then
    raise exception 'employment_status is invalid'
      using errcode = '22023';
  end if;

  if v_state is null or v_state not in ('QLD','NSW','VIC','SA','WA','NT','ACT','TAS') then
    raise exception 'state must be one of QLD, NSW, VIC, SA, WA, NT, ACT, TAS'
      using errcode = '22023';
  end if;

  if v_mobile is null then
    raise exception 'mobile is required'
      using errcode = '22023';
  end if;

  v_digits := regexp_replace(v_mobile, '[^0-9]', '', 'g');
  if char_length(v_digits) < 8 or char_length(v_digits) > 15 then
    raise exception 'mobile must contain 8 to 15 digits'
      using errcode = '22023';
  end if;
  if v_mobile !~ '^\+?[0-9][0-9[:space:]\-()]{7,24}$' then
    raise exception 'mobile format is invalid'
      using errcode = '22023';
  end if;

  if v_email is null or v_email !~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'email is invalid'
      using errcode = '22023';
  end if;

  if p_listing_id is not null then
    if not exists (
      select 1 from public.listings l where l.id = p_listing_id
    ) then
      raise exception 'listing_id not found'
        using errcode = '22023';
    end if;
  end if;

  select count(*)::int into v_recent
  from public.finance_enquiries fe
  where fe.created_at > now() - interval '1 hour'
    and (
      lower(fe.email) = v_email
      or (v_uid is not null and fe.user_id = v_uid)
    );

  if coalesce(v_recent, 0) >= 5 then
    raise exception 'Too many finance enquiries. Please try again later.'
      using errcode = 'P0001';
  end if;

  insert into public.finance_enquiries (
    user_id,
    listing_id,
    full_name,
    employment_status,
    state,
    mobile,
    email
  ) values (
    v_uid,
    p_listing_id,
    v_full_name,
    v_employment,
    v_state,
    v_mobile,
    v_email
  )
  returning id, created_at into v_id, v_created;

  return jsonb_build_object(
    'id', v_id,
    'created_at', v_created,
    'listing_id', p_listing_id,
    'user_id', v_uid
  );
end;
$function$;

revoke all on function private.submit_finance_enquiry(text, text, text, text, text, uuid) from public;
grant execute on function private.submit_finance_enquiry(text, text, text, text, text, uuid)
  to anon, authenticated, service_role;

create or replace function public.submit_finance_enquiry(
  p_full_name text,
  p_employment_status text,
  p_state text,
  p_mobile text,
  p_email text,
  p_listing_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  return private.submit_finance_enquiry(
    p_full_name,
    p_employment_status,
    p_state,
    p_mobile,
    p_email,
    p_listing_id
  );
end;
$function$;

revoke all on function public.submit_finance_enquiry(text, text, text, text, text, uuid) from public;
grant execute on function public.submit_finance_enquiry(text, text, text, text, text, uuid)
  to anon, authenticated, service_role;

comment on function public.submit_finance_enquiry(text, text, text, text, text, uuid) is
  'Submit IM DRIVN finance quiz (5 fields + optional listing_id). Sets user_id from auth.uid() only.';

-- Follow-up (also applied as finance_enquiries_public_rpc_definer):
-- public.submit_finance_enquiry must be SECURITY DEFINER so anon guests can
-- call it without GRANT USAGE on schema private.
