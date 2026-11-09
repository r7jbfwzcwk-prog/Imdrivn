-- REPO RECORD of live applied migration version 20261109212442. Do not reapply.
-- Original upload: 20261110072500_finance_enquiries_notify_5487.sql
-- Finance lead notification: temporary recipient mail@gcacars.com.au via existing Resend path.
-- Does not change from_address, wholesale, welcome, or other email flows.

insert into private.email_config as c (key, value, updated_at)
values ('finance_leads_to', 'mail@gcacars.com.au', now())
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();

create or replace function private.send_finance_enquiry_email(p_row public.finance_enquiries)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_to text;
  v_listing public.listings%rowtype;
  v_car text;
  v_listing_line text := '';
  v_subject text;
  v_rows text;
  v_html text;
  v_text text;
  v_req bigint;
  v_when text;
begin
  v_to := nullif(btrim(coalesce(private.email_cfg('finance_leads_to', null), '')), '');
  if v_to is null then
    raise warning 'send_finance_enquiry_email: finance_leads_to missing';
    return null;
  end if;

  if p_row.listing_id is not null then
    select * into v_listing from public.listings l where l.id = p_row.listing_id;
    if found then
      v_car := trim(concat_ws(' ', v_listing.year::text, v_listing.make, v_listing.model));
      v_listing_line := coalesce(nullif(v_listing.heading, ''), nullif(v_car, ''), p_row.listing_id::text);
    else
      v_listing_line := p_row.listing_id::text;
    end if;
  end if;

  v_when := to_char(p_row.created_at at time zone 'Australia/Brisbane', 'DD Mon YYYY HH12:MI am') || ' (Brisbane)';
  v_subject := 'New finance enquiry'
    || case when nullif(v_listing_line, '') is null then '' else ': ' || v_listing_line end;

  v_rows :=
       private.html_row('Full name', p_row.full_name)
    || private.html_row('Employment status', p_row.employment_status)
    || private.html_row('State', p_row.state)
    || private.html_row('Mobile', p_row.mobile)
    || private.html_row('Email', p_row.email)
    || private.html_row('Listing', case
         when p_row.listing_id is null then null
         else coalesce(v_listing_line, '') || ' [' || p_row.listing_id::text || ']'
       end)
    || private.html_row('Submitted', v_when)
    || private.html_row('Reference', p_row.id::text)
    || private.html_row('Account user', p_row.user_id::text);

  v_html :=
       '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">'
    || '<h2 style="margin:0 0 8px">New finance enquiry</h2>'
    || '<p style="margin:0 0 12px;color:#444">IM DRIVN finance quiz submission</p>'
    || '<table cellpadding="4" style="border-collapse:collapse">' || v_rows || '</table>'
    || private.email_brand_footer('light')
    || '</div>';

  v_text :=
       'New finance enquiry' || E'\n\n'
    || 'Full name: ' || coalesce(p_row.full_name, '') || E'\n'
    || 'Employment status: ' || coalesce(p_row.employment_status, '') || E'\n'
    || 'State: ' || coalesce(p_row.state, '') || E'\n'
    || 'Mobile: ' || coalesce(p_row.mobile, '') || E'\n'
    || 'Email: ' || coalesce(p_row.email, '') || E'\n'
    || 'Listing: ' || case when p_row.listing_id is null then '(none)'
         else coalesce(v_listing_line, '') || ' [' || p_row.listing_id::text || ']' end || E'\n'
    || 'Submitted: ' || v_when || E'\n'
    || 'Reference: ' || p_row.id::text || E'\n'
    || 'Account user: ' || coalesce(p_row.user_id::text, '') || E'\n\n'
    || private.email_brand_footer_text();

  v_req := private.send_email(
    v_to,
    v_subject,
    v_html,
    v_text,
    case
      when p_row.email ~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then p_row.email
      else null
    end
  );
  return v_req;
exception when others then
  raise warning 'send_finance_enquiry_email failed: %', sqlerrm;
  return null;
end;
$function$;

revoke all on function private.send_finance_enquiry_email(public.finance_enquiries) from public;

-- Rebuild submit RPC: persist first, then queue notify via private.send_email / pg_net.
-- Enquiry row is kept even when notification returns null.
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
  v_row public.finance_enquiries%rowtype;
  v_req bigint;
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
  returning * into v_row;

  -- Queue Resend via private.send_email -> net.http_post. Never fail the save.
  v_req := private.send_finance_enquiry_email(v_row);

  return jsonb_build_object(
    'id', v_row.id,
    'created_at', v_row.created_at,
    'listing_id', v_row.listing_id,
    'user_id', v_row.user_id,
    'saved', true,
    'notification_queued', (v_req is not null),
    'notification_request_id', v_req
  );
end;
$function$;

revoke all on function private.submit_finance_enquiry(text, text, text, text, text, uuid) from public;
grant execute on function private.submit_finance_enquiry(text, text, text, text, text, uuid)
  to anon, authenticated, service_role;

-- public wrapper unchanged in signature; keep SECURITY DEFINER for guest access
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
  'Submit IM DRIVN finance quiz. Persists lead then queues notify to private.email_config finance_leads_to via Resend. Returns saved + notification_queued.';

comment on function private.send_finance_enquiry_email(public.finance_enquiries) is
  'Notify finance_leads_to only (temporary: mail@gcacars.com.au). Uses private.send_email; never raises to caller.';
