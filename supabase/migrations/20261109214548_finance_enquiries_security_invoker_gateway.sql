-- REPO RECORD of live applied migration version 20261109214548. Do not reapply.
-- Source file was the CLI original 20261109214503_finance_enquiries_security_invoker_gateway_01aa.sql.
-- Replaces the exposed public definer from version 20261109212007.
-- Move privileged finance submit out of exposed public schema.
-- public.submit_finance_enquiry becomes SECURITY INVOKER and delegates to
-- unexposed app_finance.submit_finance_enquiry (SECURITY DEFINER gateway),
-- which calls existing private.submit_finance_enquiry.
-- Does NOT grant anon USAGE on private. Does not change API schema exposure.

create schema if not exists app_finance;

revoke all on schema app_finance from public;
grant usage on schema app_finance to anon, authenticated, service_role;

comment on schema app_finance is
  'Unexposed finance gateway schema. Not part of PostgREST API schemas. Holds SECURITY DEFINER entrypoints only.';

-- Test/ops kill-switch: SET LOCAL app.finance_notify_disabled = 'on' skips Resend enqueue.
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
  v_disable text;
begin
  v_disable := lower(coalesce(nullif(current_setting('app.finance_notify_disabled', true), ''), 'off'));
  if v_disable in ('on', 'true', '1', 'yes') then
    return null;
  end if;

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

create or replace function app_finance.submit_finance_enquiry(
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

revoke all on function app_finance.submit_finance_enquiry(text, text, text, text, text, uuid) from public;
grant execute on function app_finance.submit_finance_enquiry(text, text, text, text, text, uuid)
  to anon, authenticated, service_role;

comment on function app_finance.submit_finance_enquiry(text, text, text, text, text, uuid) is
  'SECURITY DEFINER gateway (unexposed schema). Delegates to private.submit_finance_enquiry.';

-- Exposed API wrapper: INVOKER only. Guests call this via /rest/v1/rpc/submit_finance_enquiry.
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
security invoker
set search_path to ''
as $function$
begin
  return app_finance.submit_finance_enquiry(
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
  'SECURITY INVOKER public RPC. Delegates to app_finance.submit_finance_enquiry; same args/response as before.';
