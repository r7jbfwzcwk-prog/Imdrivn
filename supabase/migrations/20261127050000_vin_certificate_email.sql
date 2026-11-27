-- REPO RECORD of live applied migration vin_certificate_email (27 Nov 2026). Do not reapply.
-- PPSR search certificate email (27 Nov 2026).
-- Sends ONLY the official PPSR search certificate PDF (no PPSR receipt) to the customer
-- and to the IM DRIVN admin inbox (email_config.admin_email) at the same time, via the
-- existing Resend path (vault secret resend_api_key, from_address). Service role only.

create or replace function private.send_email_attach(
  p_to text, p_subject text, p_html text, p_text text, p_reply_to text, p_attachments jsonb)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare v_key text; v_body jsonb; v_id bigint;
begin
  if p_to is null or p_to !~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise warning 'send_email_attach: bad recipient';
    return null;
  end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_key is null then raise warning 'send_email_attach: resend_api_key missing'; return null; end if;
  v_body := jsonb_build_object(
    'from', private.email_cfg('from_address', 'IM DRIVN <onboarding@resend.dev>'),
    'to', jsonb_build_array(p_to),
    'subject', p_subject,
    'html', p_html);
  if p_text is not null then v_body := v_body || jsonb_build_object('text', p_text); end if;
  if p_reply_to is not null then v_body := v_body || jsonb_build_object('reply_to', p_reply_to); end if;
  if p_attachments is not null then v_body := v_body || jsonb_build_object('attachments', p_attachments); end if;
  select net.http_post(
    url := 'https://api.resend.com/emails',
    body := v_body,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    timeout_milliseconds := 20000) into v_id;
  return v_id;
end;
$function$;

revoke all on function private.send_email_attach(text,text,text,text,text,jsonb) from public, anon, authenticated;

create or replace function public.send_vin_certificate_email(
  p_order_id uuid, p_pdf_base64 text, p_filename text, p_certificate_number text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  o public.vin_check_orders%rowtype;
  v_site text := private.email_cfg('site_url', 'https://imdrivn.com.au');
  v_admin text := lower(btrim(private.email_cfg('admin_email', 'ohhey@imdrivn.com.au')));
  v_report text;
  v_file text := coalesce(nullif(btrim(p_filename), ''), 'PPSR Search Certificate.pdf');
  v_att jsonb;
  v_rows text;
  v_inner text;
  v_html text;
  v_text text;
  v_subject text;
  v_c bigint;
  v_a bigint;
  v_cust text;
  v_gold_btn text := 'display:block;padding:20px 10px;background-color:#d9a441;background-image:linear-gradient(#f3d27a,#d9a441 45%,#a87a26);border:1px solid #f7e2a6;border-bottom:4px solid #6e4f17;border-radius:14px;text-align:center;text-decoration:none;color:#111111;';
  v_gold_text text := 'display:block;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:900;letter-spacing:0.06em;line-height:1.2;color:#111111;';
  v_lbl text := 'padding:6px 12px 6px 0;color:#9a9aa2;font-size:13px;white-space:nowrap;vertical-align:top;';
  v_val text := 'padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;word-break:break-all;';
begin
  select * into o from public.vin_check_orders where id = p_order_id;
  if not found then raise exception 'order not found'; end if;
  if coalesce(p_pdf_base64, '') = '' then raise exception 'certificate missing'; end if;
  v_report := v_site || '/#/vin/r/' || o.id::text;
  v_cust := lower(btrim(coalesce(o.email, '')));
  v_att := jsonb_build_array(jsonb_build_object('filename', v_file, 'content', p_pdf_base64, 'content_type', 'application/pdf'));
  v_rows := '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-collapse:collapse;">'
    || '<tr><td style="' || v_lbl || '">VIN</td><td style="' || v_val || '">' || private.html_esc(o.vin) || '</td></tr>'
    || '<tr><td style="' || v_lbl || '">Search number</td><td style="' || v_val || '">' || private.html_esc(coalesce(o.search_number, '')) || '</td></tr>'
    || '<tr><td style="' || v_lbl || '">Certificate number</td><td style="' || v_val || '">' || private.html_esc(coalesce(p_certificate_number, '')) || '</td></tr>'
    || '</table>';
  v_inner :=
       '<h1 style="margin:0 0 6px;font-size:24px;line-height:1.25;color:#ffffff;font-weight:900;">Your PPSR certificate is here</h1>'
    || '<p style="margin:0 0 18px;font-size:16px;font-weight:700;color:#d9a441;">Official search certificate attached</p>'
    || '<p style="margin:0 0 16px;color:#f2f2f2;">Your PPSR search is done. The official PPSR search certificate is attached to this email as a PDF. It is your legal record of the search, so save it somewhere safe.</p>'
    || v_rows
    || '<p style="margin:0 0 18px;"><a href="' || private.html_esc(v_report) || '" style="' || v_gold_btn || '"><span style="' || v_gold_text || '">VIEW MY REPORT</span></a></p>'
    || '<p style="margin:0 0 14px;color:#d4d4d4;font-size:14px;">Read the finance, stolen and written-off sections before you pay a deposit. You can check the certificate at ppsr.gov.au with the search number above.</p>'
    || '<p style="margin:0;color:#9a9aa2;font-size:13px;">Drive safe,<br><b style="color:#ffffff;">IM DRIVN</b></p>';
  v_html := private.email_shell('Your official PPSR search certificate for VIN ' || o.vin || ' is attached.', v_inner);
  v_text := 'Your PPSR certificate is here' || E'\n\n'
    || 'Your PPSR search is done. The official PPSR search certificate is attached to this email as a PDF. It is your legal record of the search, so save it somewhere safe.' || E'\n\n'
    || 'VIN: ' || o.vin || E'\n'
    || 'Search number: ' || coalesce(o.search_number, '') || E'\n'
    || 'Certificate number: ' || coalesce(p_certificate_number, '') || E'\n\n'
    || 'View my report: ' || v_report || E'\n\n'
    || 'Drive safe,' || E'\n' || 'IM DRIVN' || E'\n\n'
    || private.email_brand_footer_text();
  v_subject := 'Your PPSR certificate: ' || o.vin;

  if v_cust <> '' and v_cust <> v_admin then
    v_c := private.send_email_attach(o.email, v_subject, v_html, v_text, v_admin, v_att);
  end if;
  v_a := private.send_email_attach(v_admin,
    case when v_cust = v_admin then v_subject else 'PPSR certificate sent: ' || o.vin || ' to ' || o.email end,
    v_html, v_text, case when v_cust <> '' and v_cust <> v_admin then o.email else null end, v_att);

  if (v_c is not null or v_cust = '' or v_cust = v_admin) and v_a is not null then
    update public.vin_check_orders set report_sent_at = now(), updated_at = now() where id = o.id;
  elsif v_c is not null or v_a is not null then
    update public.vin_check_orders set report_sent_at = now(), updated_at = now(),
      notes = concat_ws(' | ', notes, 'certificate email partly queued (customer ' || coalesce(v_c::text, 'none') || ', admin ' || coalesce(v_a::text, 'none') || ')')
      where id = o.id;
  end if;
  return jsonb_build_object('customer_request', v_c, 'admin_request', v_a, 'admin', v_admin);
end;
$function$;

revoke all on function public.send_vin_certificate_email(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.send_vin_certificate_email(uuid,text,text,text) to service_role;

-- Admin "paid" email: the PPSR search now runs automatically.
create or replace function private.on_vin_check_paid()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_html text; v_admin text := private.email_cfg('admin_email','ohhey@imdrivn.com.au');
begin
  begin
    v_html := '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">'
      || '<h2 style="margin:0 0 8px">VIN check paid</h2>'
      || '<p>A customer has paid for a VIN check. The PPSR search runs automatically and the PPSR certificate is emailed to the customer and to this inbox. If no certificate arrives within a few minutes, check the order in Reports.</p>'
      || '<table cellpadding="4" style="border-collapse:collapse">'
      || private.html_row('VIN', new.vin)
      || private.html_row('Rego', new.rego)
      || private.html_row('State', new.state)
      || private.html_row('Customer email', new.email)
      || private.html_row('Amount', case when new.amount_cents is null then null else '$' || to_char(new.amount_cents/100.0,'FM999990.00') || ' ' || upper(coalesce(new.currency,'aud')) end)
      || private.html_row('Listing', case when new.listing_id is null then null else private.email_cfg('site_url','https://imdrivn.com.au') || '/#/car/' || new.listing_id end)
      || private.html_row('Order id', new.id::text)
      || private.html_row('Stripe payment', new.stripe_payment_intent_id)
      || private.html_row('Paid at', to_char(coalesce(new.paid_at, now()) at time zone 'Australia/Brisbane','DD Mon YYYY HH12:MI AM') || ' AEST')
      || '</table>'
      || private.email_brand_footer('light')
      || '</div>';
    perform private.send_email(v_admin, 'VIN check paid: ' || new.vin, v_html,
      'VIN check paid. VIN: ' || new.vin || ' Customer: ' || new.email || ' Order: ' || new.id || E'\n\n' || private.email_brand_footer_text(), new.email);
  exception when others then raise warning 'on_vin_check_paid email failed: %', sqlerrm;
  end;
  return new;
end $function$;
