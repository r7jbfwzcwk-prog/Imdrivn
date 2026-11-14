-- Push contact rows to the Google sheet configured in
-- private.contacts_sheet_config. The token is read there and never
-- written into this file. A sheet failure must not roll back the save.

create or replace function private.contacts_sheet_iso(p_at timestamptz)
returns text
language sql
immutable
as $$
  select case
    when p_at is null then ''
    else to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  end
$$;

create or replace function private.contacts_sheet_test(p_email text, p_username text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_username, '') = 'bantest'
    or coalesce(p_email, '') ilike '%bantest%'
    or coalesce(p_email, '') ilike '%@example.%'
    or coalesce(p_email, '') ilike '%@mail.grokbot.com'
$$;

create or replace function private.contacts_sheet_send(p_body jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_url text;
  v_token text;
begin
  select c.url, c.token into v_url, v_token
  from private.contacts_sheet_config c
  where c.id = 1;
  if v_url is null or v_token is null or length(btrim(v_url)) = 0 then
    raise warning 'contacts_sheet_send: sheet config missing';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_strip_nulls(p_body) || jsonb_build_object('token', v_token),
    params := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 20000
  );
exception when others then
  raise warning 'contacts_sheet_send failed: %', sqlerrm;
end;
$$;

create or replace function private.contacts_sheet_member_opt(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((
    select p.marketing_opt_in
    from public.profiles p
    where p.id = p_user
  ), false)
$$;

create or replace function private.contacts_sheet_push(
  p_at timestamptz,
  p_name text,
  p_email text,
  p_mobile text,
  p_source text,
  p_opt boolean,
  p_opted_out timestamptz,
  p_details text,
  p_id text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
begin
  if v_email is null then
    return;
  end if;
  perform private.contacts_sheet_send(jsonb_build_object(
    'rows', jsonb_build_array(jsonb_build_object(
      'date', private.contacts_sheet_iso(coalesce(p_at, now())),
      'name', btrim(coalesce(p_name, '')),
      'email', v_email,
      'mobile', btrim(coalesce(p_mobile, '')),
      'source', p_source,
      'opt_in', coalesce(p_opt, false),
      'opted_out_on', case when coalesce(p_opt, false) then '' else private.contacts_sheet_iso(p_opted_out) end,
      'details', left(btrim(coalesce(p_details, '')), 180),
      'id', coalesce(p_id, '')
    ))
  ));
exception when others then
  raise warning 'contacts_sheet_push failed: %', sqlerrm;
end;
$$;

create or replace function private.contacts_sheet_on_signup()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_email text;
  v_name text;
  v_phone text;
begin
  select u.email,
         nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), '')
    into v_email, v_name
  from auth.users u
  where u.id = new.id;
  select nullif(btrim(c.phone_e164), '') into v_phone
  from private.member_contacts c
  where c.user_id = new.id;
  perform private.contacts_sheet_push(
    coalesce(new.created_at, now()),
    coalesce(v_name, nullif(btrim(new.display_name), ''), nullif(btrim(new.username), ''), 'Member'),
    v_email,
    coalesce(v_phone, nullif(btrim(new.phone), '')),
    'Signup',
    coalesce(new.marketing_opt_in, true),
    case when coalesce(new.marketing_opt_in, true) then null else new.marketing_opt_out_at end,
    case when nullif(btrim(new.username), '') is null then 'New member' else '@' || new.username end,
    new.id::text
  );
  return new;
exception when others then
  raise warning 'contacts_sheet_on_signup failed: %', sqlerrm;
  return new;
end;
$$;

create or replace function private.contacts_sheet_on_opt()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_email text;
begin
  if new.marketing_opt_in is not distinct from old.marketing_opt_in then
    return new;
  end if;
  select u.email into v_email from auth.users u where u.id = new.id;
  if v_email is null or btrim(v_email) = '' then
    return new;
  end if;
  perform private.contacts_sheet_send(jsonb_build_object(
    'action', case when new.marketing_opt_in then 'optin' else 'optout' end,
    'email', btrim(v_email),
    'date', private.contacts_sheet_iso(case when new.marketing_opt_in then now() else coalesce(new.marketing_opt_out_at, now()) end)
  ));
  return new;
exception when others then
  raise warning 'contacts_sheet_on_opt failed: %', sqlerrm;
  return new;
end;
$$;

create or replace function private.contacts_sheet_on_wholesale()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_on boolean := private.contacts_sheet_member_opt(new.user_id);
  v_out timestamptz;
begin
  if v_on then
    v_out := null;
  else
    select p.marketing_opt_out_at into v_out from public.profiles p where p.id = new.user_id;
  end if;
  perform private.contacts_sheet_push(
    new.created_at, new.contact_name, new.contact_email, new.contact_phone,
    'Wholesale', v_on, v_out,
    trim(concat_ws(' ', new.year::text, new.make, new.model)),
    new.id::text
  );
  return new;
exception when others then
  raise warning 'contacts_sheet_on_wholesale failed: %', sqlerrm;
  return new;
end;
$$;

create or replace function private.contacts_sheet_on_finance()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_on boolean := private.contacts_sheet_member_opt(new.user_id);
  v_out timestamptz;
begin
  if not v_on then
    select p.marketing_opt_out_at into v_out from public.profiles p where p.id = new.user_id;
  end if;
  perform private.contacts_sheet_push(
    new.created_at, new.full_name, new.email, new.mobile,
    'Finance', v_on, v_out,
    trim(concat_ws(' ', new.employment_status, new.state)),
    new.id::text
  );
  return new;
exception when others then
  raise warning 'contacts_sheet_on_finance failed: %', sqlerrm;
  return new;
end;
$$;

create or replace function private.contacts_sheet_on_partner()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_on boolean := private.contacts_sheet_member_opt(new.user_id);
  v_out timestamptz;
begin
  if not v_on then
    select p.marketing_opt_out_at into v_out from public.profiles p where p.id = new.user_id;
  end if;
  perform private.contacts_sheet_push(
    new.created_at, new.contact_name, new.email, new.phone,
    'Partner enquiry', v_on, v_out,
    new.business_name, new.id::text
  );
  return new;
exception when others then
  raise warning 'contacts_sheet_on_partner failed: %', sqlerrm;
  return new;
end;
$$;

create or replace function private.contacts_sheet_on_contact()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_on boolean := private.contacts_sheet_member_opt(new.user_id);
  v_out timestamptz;
begin
  if not v_on then
    select p.marketing_opt_out_at into v_out from public.profiles p where p.id = new.user_id;
  end if;
  perform private.contacts_sheet_push(
    new.created_at, new.name, new.email, '',
    'Contact form', v_on, v_out,
    new.topic, new.id::text
  );
  return new;
exception when others then
  raise warning 'contacts_sheet_on_contact failed: %', sqlerrm;
  return new;
end;
$$;

create or replace function private.contacts_sheet_on_vin()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_on boolean := private.contacts_sheet_member_opt(new.user_id);
  v_out timestamptz;
begin
  if not v_on then
    select p.marketing_opt_out_at into v_out from public.profiles p where p.id = new.user_id;
  end if;
  perform private.contacts_sheet_push(
    new.created_at, '', new.email, '',
    'VIN check', v_on, v_out,
    new.vin, new.id::text
  );
  return new;
exception when others then
  raise warning 'contacts_sheet_on_vin failed: %', sqlerrm;
  return new;
end;
$$;

create or replace function private.contacts_sheet_on_order()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_on boolean := private.contacts_sheet_member_opt(new.user_id);
  v_out timestamptz;
begin
  if not v_on then
    select p.marketing_opt_out_at into v_out from public.profiles p where p.id = new.user_id;
  end if;
  perform private.contacts_sheet_push(
    new.created_at, new.shipping_name, new.email, new.shipping_phone,
    'Order', v_on, v_out,
    new.status, new.id::text
  );
  return new;
exception when others then
  raise warning 'contacts_sheet_on_order failed: %', sqlerrm;
  return new;
end;
$$;

create or replace function private.contacts_sheet_on_listing_contact()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_on boolean := private.contacts_sheet_member_opt(new.user_id);
  v_name text;
  v_out timestamptz;
begin
  select coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''))
    into v_name
  from public.profiles p
  where p.id = new.user_id;
  if not v_on then
    select p.marketing_opt_out_at into v_out from public.profiles p where p.id = new.user_id;
  end if;
  perform private.contacts_sheet_push(
    new.created_at, v_name, new.email, new.mobile,
    'Listing contact', v_on, v_out,
    'Listing ' || new.listing_id::text, new.listing_id::text
  );
  return new;
exception when others then
  raise warning 'contacts_sheet_on_listing_contact failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists contacts_sheet_signup on public.profiles;
create trigger contacts_sheet_signup
  after insert on public.profiles
  for each row execute function private.contacts_sheet_on_signup();

drop trigger if exists contacts_sheet_opt on public.profiles;
create trigger contacts_sheet_opt
  after update of marketing_opt_in on public.profiles
  for each row execute function private.contacts_sheet_on_opt();

drop trigger if exists contacts_sheet_wholesale on public.valuations;
create trigger contacts_sheet_wholesale
  after insert on public.valuations
  for each row execute function private.contacts_sheet_on_wholesale();

drop trigger if exists contacts_sheet_finance on public.finance_enquiries;
create trigger contacts_sheet_finance
  after insert on public.finance_enquiries
  for each row execute function private.contacts_sheet_on_finance();

drop trigger if exists contacts_sheet_partner on public.partner_enquiries;
create trigger contacts_sheet_partner
  after insert on public.partner_enquiries
  for each row execute function private.contacts_sheet_on_partner();

drop trigger if exists contacts_sheet_contact on public.contact_messages;
create trigger contacts_sheet_contact
  after insert on public.contact_messages
  for each row execute function private.contacts_sheet_on_contact();

drop trigger if exists contacts_sheet_vin on public.vin_check_orders;
create trigger contacts_sheet_vin
  after insert on public.vin_check_orders
  for each row execute function private.contacts_sheet_on_vin();

drop trigger if exists contacts_sheet_order on public.orders;
create trigger contacts_sheet_order
  after insert on public.orders
  for each row execute function private.contacts_sheet_on_order();

drop trigger if exists contacts_sheet_listing_contact on public.listing_contacts;
create trigger contacts_sheet_listing_contact
  after insert on public.listing_contacts
  for each row execute function private.contacts_sheet_on_listing_contact();

revoke all on function private.contacts_sheet_send(jsonb) from public, anon, authenticated;
revoke all on function private.contacts_sheet_push(timestamptz, text, text, text, text, boolean, timestamptz, text, text) from public, anon, authenticated;
revoke all on function private.contacts_sheet_on_signup() from public, anon, authenticated;
revoke all on function private.contacts_sheet_on_opt() from public, anon, authenticated;

-- One-off loader. Returns counts only. Oldest first, 20 rows at a time.
create or replace function private.contacts_sheet_backfill()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_all jsonb := '[]'::jsonb;
  v_batch jsonb;
  v_i int := 0;
  v_n int;
  v_counts jsonb;
begin
  with rows as (
    select p.created_at as at, 'Signup'::text as source, p.id::text as id,
           coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), nullif(btrim(u.raw_user_meta_data->>'name'), ''), nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'Member') as name,
           u.email as email,
           coalesce(nullif(btrim(c.phone_e164), ''), nullif(btrim(p.phone), ''), '') as mobile,
           coalesce(p.marketing_opt_in, true) as opt_in,
           case when coalesce(p.marketing_opt_in, true) then null else p.marketing_opt_out_at end as opted_out,
           case when nullif(btrim(p.username), '') is null then 'New member' else '@' || p.username end as details
    from public.profiles p
    join auth.users u on u.id = p.id
    left join private.member_contacts c on c.user_id = p.id
    where u.email is not null and btrim(u.email) <> ''
      and not private.contacts_sheet_test(u.email, p.username)
    union all
    select v.created_at, 'Wholesale', v.id::text, v.contact_name, v.contact_email, coalesce(v.contact_phone, ''),
           private.contacts_sheet_member_opt(v.user_id),
           case when private.contacts_sheet_member_opt(v.user_id) then null else (select p.marketing_opt_out_at from public.profiles p where p.id = v.user_id) end,
           trim(concat_ws(' ', v.year::text, v.make, v.model))
    from public.valuations v
    where v.contact_email is not null and not private.contacts_sheet_test(v.contact_email, null)
    union all
    select f.created_at, 'Finance', f.id::text, f.full_name, f.email, coalesce(f.mobile, ''),
           private.contacts_sheet_member_opt(f.user_id),
           case when private.contacts_sheet_member_opt(f.user_id) then null else (select p.marketing_opt_out_at from public.profiles p where p.id = f.user_id) end,
           trim(concat_ws(' ', f.employment_status, f.state))
    from public.finance_enquiries f
    where f.email is not null and not private.contacts_sheet_test(f.email, null)
    union all
    select e.created_at, 'Partner enquiry', e.id::text, e.contact_name, e.email, coalesce(e.phone, ''),
           private.contacts_sheet_member_opt(e.user_id),
           case when private.contacts_sheet_member_opt(e.user_id) then null else (select p.marketing_opt_out_at from public.profiles p where p.id = e.user_id) end,
           e.business_name
    from public.partner_enquiries e
    where e.email is not null and not private.contacts_sheet_test(e.email, null)
    union all
    select m.created_at, 'Contact form', m.id::text, m.name, m.email, '',
           private.contacts_sheet_member_opt(m.user_id),
           case when private.contacts_sheet_member_opt(m.user_id) then null else (select p.marketing_opt_out_at from public.profiles p where p.id = m.user_id) end,
           m.topic
    from public.contact_messages m
    where m.email is not null and not private.contacts_sheet_test(m.email, null)
    union all
    select o.created_at, 'VIN check', o.id::text, '', o.email, '',
           private.contacts_sheet_member_opt(o.user_id),
           case when private.contacts_sheet_member_opt(o.user_id) then null else (select p.marketing_opt_out_at from public.profiles p where p.id = o.user_id) end,
           o.vin
    from public.vin_check_orders o
    where o.email is not null and not private.contacts_sheet_test(o.email, null)
    union all
    select r.created_at, 'Order', r.id::text, r.shipping_name, r.email, coalesce(r.shipping_phone, ''),
           private.contacts_sheet_member_opt(r.user_id),
           case when private.contacts_sheet_member_opt(r.user_id) then null else (select p.marketing_opt_out_at from public.profiles p where p.id = r.user_id) end,
           r.status
    from public.orders r
    where r.email is not null and not private.contacts_sheet_test(r.email, null)
    union all
    select l.created_at, 'Listing contact', l.listing_id::text,
           coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), '')),
           l.email, coalesce(l.mobile, ''),
           private.contacts_sheet_member_opt(l.user_id),
           case when private.contacts_sheet_member_opt(l.user_id) then null else p.marketing_opt_out_at end,
           'Listing ' || l.listing_id::text
    from public.listing_contacts l
    left join public.profiles p on p.id = l.user_id
    where l.email is not null and not private.contacts_sheet_test(l.email, p.username)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', private.contacts_sheet_iso(at),
    'name', btrim(coalesce(name, '')),
    'email', btrim(email),
    'mobile', btrim(coalesce(mobile, '')),
    'source', source,
    'opt_in', opt_in,
    'opted_out_on', case when opt_in then '' else private.contacts_sheet_iso(opted_out) end,
    'details', left(btrim(coalesce(details, '')), 180),
    'id', id
  ) order by at, source, id), '[]'::jsonb)
  into v_all
  from rows;

  v_n := jsonb_array_length(v_all);
  while v_i < v_n loop
    select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_batch
    from (
      select value as elem
      from jsonb_array_elements(v_all) with ordinality
      where ordinality > v_i and ordinality <= v_i + 20
      order by ordinality
    ) s;
    perform private.contacts_sheet_send(jsonb_build_object('rows', v_batch));
    v_i := v_i + 20;
  end loop;

  select coalesce(jsonb_object_agg(source, n), '{}'::jsonb) into v_counts
  from (
    select value->>'source' as source, count(*) as n
    from jsonb_array_elements(v_all)
    group by 1
  ) c;
  return jsonb_build_object('total', v_n, 'batches', ceil(v_n / 20.0), 'by_source', v_counts);
exception when others then
  raise warning 'contacts_sheet_backfill failed: %', sqlerrm;
  return jsonb_build_object('error', sqlerrm);
end;
$$;

revoke all on function private.contacts_sheet_backfill() from public, anon, authenticated;
