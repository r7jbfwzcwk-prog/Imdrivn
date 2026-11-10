-- Partner enquiries. Guests submit via public.submit_partner_enquiry.
-- Email uses the existing finance_leads_to recipient and private.send_email.

create table if not exists public.partner_enquiries (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  phone text not null,
  email text not null,
  website text,
  message text not null,
  user_id uuid,
  created_at timestamptz not null default now(),
  constraint partner_enquiries_business_len check (char_length(btrim(business_name)) between 2 and 120),
  constraint partner_enquiries_contact_len check (char_length(btrim(contact_name)) between 2 and 120),
  constraint partner_enquiries_phone_len check (char_length(btrim(phone)) between 8 and 20),
  constraint partner_enquiries_email_format check (email ~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  constraint partner_enquiries_website_len check (website is null or char_length(btrim(website)) between 0 and 200),
  constraint partner_enquiries_message_len check (char_length(btrim(message)) between 8 and 2000)
);

comment on table public.partner_enquiries is
  'Partner spot enquiries. Not publicly readable. Insert only via submit_partner_enquiry.';

alter table public.partner_enquiries enable row level security;

revoke all on table public.partner_enquiries from anon, authenticated;
grant all on table public.partner_enquiries to service_role;

create schema if not exists app_partners;

revoke all on schema app_partners from public;
grant usage on schema app_partners to anon, authenticated, service_role;

comment on schema app_partners is
  'Unexposed partner gateway schema. Holds the SECURITY DEFINER entrypoint only.';

create or replace function private.submit_partner_enquiry(
  p_business_name text,
  p_contact_name text,
  p_phone text,
  p_email text,
  p_website text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_business text := btrim(coalesce(p_business_name, ''));
  v_contact text := btrim(coalesce(p_contact_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_website text := nullif(btrim(coalesce(p_website, '')), '');
  v_message text := btrim(coalesce(p_message, ''));
  v_uid uuid := auth.uid();
  v_row public.partner_enquiries%rowtype;
  v_recent int;
  v_to text;
  v_when text;
  v_html text;
  v_text text;
  v_rows text;
begin
  if char_length(v_business) < 2 or char_length(v_business) > 120 then
    raise exception 'Add the business name.' using errcode = '22023';
  end if;
  if char_length(v_contact) < 2 or char_length(v_contact) > 120 then
    raise exception 'Add a contact name.' using errcode = '22023';
  end if;
  if char_length(v_phone) < 8 or char_length(v_phone) > 20 then
    raise exception 'Add a phone number.' using errcode = '22023';
  end if;
  if v_email !~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Add a valid email.' using errcode = '22023';
  end if;
  if v_website is not null and char_length(v_website) > 200 then
    raise exception 'That website is too long.' using errcode = '22023';
  end if;
  if char_length(v_message) < 8 or char_length(v_message) > 2000 then
    raise exception 'Add a short message.' using errcode = '22023';
  end if;

  select count(*)::int into v_recent
  from public.partner_enquiries pe
  where pe.created_at > now() - interval '1 hour'
    and lower(pe.email) = v_email;

  if coalesce(v_recent, 0) >= 5 then
    raise exception 'Too many partner enquiries. Please try again later.'
      using errcode = 'P0001';
  end if;

  insert into public.partner_enquiries (
    user_id, business_name, contact_name, phone, email, website, message
  ) values (
    v_uid, v_business, v_contact, v_phone, v_email, v_website, v_message
  )
  returning * into v_row;

  begin
    v_to := nullif(btrim(coalesce(private.email_cfg('finance_leads_to', null), '')), '');
    if v_to is not null then
      v_when := to_char(v_row.created_at at time zone 'Australia/Brisbane', 'DD Mon YYYY HH12:MI am') || ' (Brisbane)';
      v_rows :=
           private.html_row('Business', v_row.business_name)
        || private.html_row('Contact', v_row.contact_name)
        || private.html_row('Phone', v_row.phone)
        || private.html_row('Email', v_row.email)
        || private.html_row('Website', v_row.website)
        || private.html_row('Message', v_row.message)
        || private.html_row('Submitted', v_when)
        || private.html_row('Reference', v_row.id::text);
      v_html :=
           '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">'
        || '<h2 style="margin:0 0 8px">New partner enquiry</h2>'
        || '<table cellpadding="4" style="border-collapse:collapse">' || v_rows || '</table>'
        || private.email_brand_footer('light')
        || '</div>';
      v_text :=
           'New partner enquiry' || E'\n\n'
        || 'Business: ' || v_row.business_name || E'\n'
        || 'Contact: ' || v_row.contact_name || E'\n'
        || 'Phone: ' || v_row.phone || E'\n'
        || 'Email: ' || v_row.email || E'\n'
        || 'Website: ' || coalesce(v_row.website, '') || E'\n'
        || 'Message: ' || v_row.message || E'\n'
        || 'Submitted: ' || v_when || E'\n'
        || 'Reference: ' || v_row.id::text || E'\n\n'
        || private.email_brand_footer_text();
      perform private.send_email(v_to, 'New partner enquiry: ' || v_row.business_name, v_html, v_text, v_row.email);
    end if;
  exception when others then
    raise warning 'submit_partner_enquiry email failed: %', sqlerrm;
  end;

  return jsonb_build_object(
    'id', v_row.id,
    'created_at', v_row.created_at,
    'saved', true
  );
end;
$function$;

revoke all on function private.submit_partner_enquiry(text, text, text, text, text, text) from public;

create or replace function app_partners.submit_partner_enquiry(
  p_business_name text,
  p_contact_name text,
  p_phone text,
  p_email text,
  p_website text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  return private.submit_partner_enquiry(
    p_business_name,
    p_contact_name,
    p_phone,
    p_email,
    p_website,
    p_message
  );
end;
$function$;

revoke all on function app_partners.submit_partner_enquiry(text, text, text, text, text, text) from public;
grant execute on function app_partners.submit_partner_enquiry(text, text, text, text, text, text)
  to anon, authenticated, service_role;

create or replace function public.submit_partner_enquiry(
  p_business_name text,
  p_contact_name text,
  p_phone text,
  p_email text,
  p_website text,
  p_message text
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  return app_partners.submit_partner_enquiry(
    p_business_name,
    p_contact_name,
    p_phone,
    p_email,
    p_website,
    p_message
  );
end;
$function$;

revoke all on function public.submit_partner_enquiry(text, text, text, text, text, text) from public;
grant execute on function public.submit_partner_enquiry(text, text, text, text, text, text)
  to anon, authenticated, service_role;

comment on function public.submit_partner_enquiry(text, text, text, text, text, text) is
  'SECURITY INVOKER public RPC. Delegates to app_partners.submit_partner_enquiry.';
