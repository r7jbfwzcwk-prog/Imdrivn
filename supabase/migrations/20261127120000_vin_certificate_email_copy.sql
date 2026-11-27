-- REPO / PACKAGE RECORD only until Joe's push (27 Nov 2026).
-- Do NOT apply to production on its own. Goes live with the site package
-- (VIN-only signed-in flow, on-site report + certificate PDF).
-- Replaces public.send_vin_certificate_email copy: Oh Hey @username greeting,
-- Joe's certificate email wording, VIEW MY REPORT -> https://imdrivn.com.au/#/vin/r/<order_id>.
-- Looks up the customer's profiles.username. Falls back to "Oh Hey there".
-- Certificate emails still go to the order email (the signed-in account email,
-- set by create-checkout / ppsr-vin-search) and to email_config.admin_email.

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
  v_username text;
  v_greet text;
  v_cert_no text;
  v_gold_btn text := 'display:block;padding:22px 10px;background-color:#d9a441;background-image:linear-gradient(#f3d27a,#d9a441 45%,#a87a26);border:1px solid #f7e2a6;border-bottom:4px solid #6e4f17;border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 4px 8px rgba(0,0,0,.7);text-align:center;text-decoration:none;color:#111111;';
  v_gold_text text := 'display:block;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:900;letter-spacing:0.06em;line-height:1.2;color:#111111;';
  v_lbl text := 'padding:6px 12px 6px 0;color:#9a9aa2;font-size:13px;white-space:nowrap;vertical-align:top;';
  v_val text := 'padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;word-break:break-all;';
begin
  select * into o from public.vin_check_orders where id = p_order_id;
  if not found then raise exception 'order not found'; end if;
  if coalesce(p_pdf_base64, '') = '' then raise exception 'certificate missing'; end if;
  v_report := v_site || '/#/vin/r/' || o.id::text;
  v_cust := lower(btrim(coalesce(o.email, '')));
  v_cert_no := coalesce(nullif(btrim(p_certificate_number), ''), nullif(btrim(o.search_number), ''), '');
  if o.user_id is not null then
    select nullif(btrim(p.username), '') into v_username
      from public.profiles p where p.id = o.user_id;
  end if;
  if v_username is not null then
    v_greet := 'Oh Hey @' || v_username;
  else
    v_greet := 'Oh Hey there';
  end if;
  v_att := jsonb_build_array(jsonb_build_object('filename', v_file, 'content', p_pdf_base64, 'content_type', 'application/pdf'));
  v_rows := '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-collapse:collapse;">'
    || '<tr><td style="' || v_lbl || '">VIN</td><td style="' || v_val || '">' || private.html_esc(o.vin) || '</td></tr>'
    || '<tr><td style="' || v_lbl || '">Certificate Number</td><td style="' || v_val || '">' || private.html_esc(v_cert_no) || '</td></tr>'
    || '</table>';
  v_inner :=
       '<p style="margin:0 0 14px;font-size:18px;font-weight:700;color:#d9a441;">' || private.html_esc(v_greet) || '</p>'
    || '<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#ffffff;font-weight:900;">Your Official PPSR certificate is here!!</h1>'
    || '<p style="margin:0 0 18px;font-size:16px;font-weight:700;color:#d9a441;">Pay special attention to the finance, stolen and written-off sections before you buy or pay a deposit!</p>'
    || v_rows
    || '<p style="margin:0 0 18px;"><a href="' || private.html_esc(v_report) || '" style="' || v_gold_btn || '"><span style="' || v_gold_text || '">VIEW MY REPORT</span></a></p>'
    || '<p style="margin:0 0 18px;color:#f2f2f2;">Your PPSR search is done and the Official PPSR search certificate is attached to this email as a PDF. It is your legal record of the search, so save it somewhere safe.</p>'
    || '<p style="margin:0;color:#9a9aa2;font-size:13px;">Drive safe,<br><b style="color:#ffffff;">IM DRIVN</b></p>';
  v_html := private.email_shell('Your official PPSR search certificate for VIN ' || o.vin || ' is attached.', v_inner);
  v_text := v_greet || E'\n\n'
    || 'Your Official PPSR certificate is here!!' || E'\n\n'
    || 'Pay special attention to the finance, stolen and written-off sections before you buy or pay a deposit!' || E'\n\n'
    || 'VIN: ' || o.vin || E'\n'
    || 'Certificate Number: ' || v_cert_no || E'\n\n'
    || 'View my report: ' || v_report || E'\n\n'
    || 'Your PPSR search is done and the Official PPSR search certificate is attached to this email as a PDF. It is your legal record of the search, so save it somewhere safe.' || E'\n\n'
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
  return jsonb_build_object('customer_request', v_c, 'admin_request', v_a, 'admin', v_admin, 'greeting', v_greet);
end;
$function$;

revoke all on function public.send_vin_certificate_email(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.send_vin_certificate_email(uuid,text,text,text) to service_role;
