-- REPO / PACKAGE RECORD only until Joe's push (27 Nov 2026).
-- Do NOT apply to production on its own. Goes live with the site package.
-- When a completed PPSR search shows a stolen record, record a row in
-- public.vin_alerts and email ohhey@imdrivn.com.au. Do NOT auto-submit to
-- Crime Stoppers. The email and the alert row include a prefilled report
-- for Joe to paste at the official online form:
--   https://report.crimestoppersqld.com.au/report-form/
-- (linked from https://www.crimestoppersqld.com.au/make-a-report/ — verified 27 Nov 2026).
--
-- How the IM DRIVN Admin bot can read alerts (no extra deploy beyond this
-- migration and the ppsr-vin-search hook):
--   * Table: public.vin_alerts
--   * Admins (public.is_admin()) can SELECT their rows; service_role can
--     SELECT/INSERT/UPDATE. There is no public or buyer access.
--   * Realtime is enabled, so the bot can subscribe to INSERT on vin_alerts
--     or poll: select * from public.vin_alerts where kind = 'stolen'
--     order by created_at desc.
--   * Useful columns: vin, order_id, search_number, buyer_username,
--     listing_url, stolen_summary, stolen_records, crime_stoppers_text,
--     report_url, email_request_id, created_at.
--   * The bot should open a chat or inbox item for Joe with
--     crime_stoppers_text and the report_url. It must not submit the
--     report to Crime Stoppers itself.

create table if not exists public.vin_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind = 'stolen'),
  order_id uuid not null references public.vin_check_orders(id) on delete cascade,
  vin text not null,
  search_number text,
  listing_id uuid references public.listings(id) on delete set null,
  buyer_id uuid,
  buyer_username text,
  buyer_email text,
  stolen_summary text,
  stolen_records jsonb not null default '[]'::jsonb,
  listing_url text,
  report_url text not null default 'https://report.crimestoppersqld.com.au/report-form/',
  crime_stoppers_text text not null,
  email_request_id bigint,
  created_at timestamptz not null default now(),
  unique (kind, order_id)
);

comment on table public.vin_alerts is
  'Admin-only PPSR stolen alerts for the IM DRIVN Admin bot and Joe. Not submitted to Crime Stoppers automatically.';

create index if not exists vin_alerts_created_idx
  on public.vin_alerts (created_at desc);

alter table public.vin_alerts enable row level security;

revoke all on public.vin_alerts from public, anon, authenticated;
grant select on public.vin_alerts to authenticated;
grant all on public.vin_alerts to service_role;

drop policy if exists vin_alerts_select_admin on public.vin_alerts;
create policy vin_alerts_select_admin
  on public.vin_alerts
  for select
  to authenticated
  using (public.is_admin());

alter table public.vin_alerts replica identity full;

do $pub$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vin_alerts'
  ) then
    alter publication supabase_realtime add table public.vin_alerts;
  end if;
end
$pub$;

create or replace function private.vin_result_is_stolen(p_result jsonb)
returns boolean
language plpgsql
immutable
as $function$
declare
  v_nev jsonb := coalesce(p_result->'nevdis', '{}'::jsonb);
  v_text text := lower(btrim(coalesce(v_nev->>'stolen', '')));
  v_records jsonb := coalesce(v_nev->'stolenRecords', '[]'::jsonb);
begin
  if jsonb_typeof(v_records) = 'array' and jsonb_array_length(v_records) > 0 then
    return true;
  end if;
  if v_text = '' or v_text = 'no record' or v_text = 'not stated' or v_text = '-' or v_text like 'not verified%' then
    return false;
  end if;
  return true;
end;
$function$;

create or replace function public.record_vin_stolen_alert(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  o public.vin_check_orders%rowtype;
  v_site text := private.email_cfg('site_url', 'https://imdrivn.com.au');
  v_admin text := lower(btrim(private.email_cfg('admin_email', 'ohhey@imdrivn.com.au')));
  v_report_url text := 'https://report.crimestoppersqld.com.au/report-form/';
  v_listing_url text;
  v_username text;
  v_nev jsonb;
  v_summary text;
  v_records jsonb;
  v_vehicle text;
  v_rego text;
  v_cs text;
  v_html text;
  v_text text;
  v_inner text;
  v_req bigint;
  v_id uuid;
  v_existing public.vin_alerts%rowtype;
begin
  if p_order_id is null then
    raise exception 'order id required';
  end if;
  select * into o from public.vin_check_orders where id = p_order_id;
  if not found then
    raise exception 'order not found';
  end if;
  if o.status is distinct from 'complete' or o.result is null then
    return jsonb_build_object('ok', false, 'reason', 'order not complete');
  end if;
  if not private.vin_result_is_stolen(o.result) then
    return jsonb_build_object('ok', false, 'reason', 'not stolen');
  end if;

  select * into v_existing from public.vin_alerts where kind = 'stolen' and order_id = o.id;
  if found then
    return jsonb_build_object('ok', true, 'id', v_existing.id, 'duplicate', true);
  end if;

  v_nev := coalesce(o.result->'nevdis', '{}'::jsonb);
  v_summary := nullif(btrim(coalesce(v_nev->>'stolen', '')), '');
  v_records := case when jsonb_typeof(v_nev->'stolenRecords') = 'array' then v_nev->'stolenRecords' else '[]'::jsonb end;
  if o.user_id is not null then
    select nullif(btrim(p.username), '') into v_username from public.profiles p where p.id = o.user_id;
  end if;
  if o.listing_id is not null then
    v_listing_url := v_site || '/#/car/' || o.listing_id::text;
  end if;
  v_vehicle := nullif(btrim(concat_ws(' ', v_nev->>'year', v_nev->>'make', v_nev->>'model')), '');
  v_rego := nullif(btrim(concat_ws(' ', v_nev->>'rego', v_nev->>'jurisdiction')), '');

  v_cs :=
    'I am reporting a vehicle that returned a stolen record on a PPSR search.' || E'\n\n'
    || 'VIN: ' || coalesce(o.vin, '') || E'\n'
    || 'Make / model / year: ' || coalesce(v_vehicle, 'Not stated on the search') || E'\n'
    || 'Registration (if known): ' || coalesce(v_rego, 'Not stated on the search') || E'\n'
    || 'PPSR search number: ' || coalesce(nullif(btrim(coalesce(o.search_number, o.result->>'searchNumber')), ''), 'Not stated') || E'\n'
    || 'PPSR stolen record: ' || coalesce(
          nullif(btrim(array_to_string(array(select jsonb_array_elements_text(v_records)), '; ')), ''),
          v_summary,
          'Stolen record returned'
        ) || E'\n'
    || 'IM DRIVN listing: ' || coalesce(v_listing_url, 'No listing was attached to this search') || E'\n'
    || 'IM DRIVN report: ' || v_site || '/#/vin/r/' || o.id::text || E'\n'
    || 'IM DRIVN order id: ' || o.id::text || E'\n\n'
    || 'This information comes from an official PPSR serial number search completed on IM DRIVN. Please treat it as a report of a stolen vehicle record, not a confirmed sighting.';

  insert into public.vin_alerts (
    kind, order_id, vin, search_number, listing_id, buyer_id, buyer_username, buyer_email,
    stolen_summary, stolen_records, listing_url, report_url, crime_stoppers_text
  ) values (
    'stolen', o.id, o.vin, nullif(btrim(coalesce(o.search_number, o.result->>'searchNumber')), ''),
    o.listing_id, o.user_id, v_username, o.email,
    v_summary, v_records, v_listing_url, v_report_url, v_cs
  )
  on conflict (kind, order_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.vin_alerts where kind = 'stolen' and order_id = o.id;
    return jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true);
  end if;

  v_inner :=
    '<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#ffffff;font-weight:900;">Stolen vehicle alert</h1>'
    || '<p style="margin:0 0 18px;font-size:16px;font-weight:700;color:#ff5a5a;">A completed PPSR search on IM DRIVN returned a stolen record. This email is for you only. It has not been sent to Crime Stoppers.</p>'
    || '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-collapse:collapse;">'
    || '<tr><td style="padding:6px 12px 6px 0;color:#9a9aa2;font-size:13px;vertical-align:top;">VIN</td><td style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;">' || private.html_esc(o.vin) || '</td></tr>'
    || '<tr><td style="padding:6px 12px 6px 0;color:#9a9aa2;font-size:13px;vertical-align:top;">Order id</td><td style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;">' || private.html_esc(o.id::text) || '</td></tr>'
    || '<tr><td style="padding:6px 12px 6px 0;color:#9a9aa2;font-size:13px;vertical-align:top;">Buyer</td><td style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;">' || private.html_esc(coalesce('@' || v_username, o.email, 'Not stated')) || '</td></tr>'
    || '<tr><td style="padding:6px 12px 6px 0;color:#9a9aa2;font-size:13px;vertical-align:top;">Listing</td><td style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;">' || private.html_esc(coalesce(v_listing_url, 'No listing attached')) || '</td></tr>'
    || '<tr><td style="padding:6px 12px 6px 0;color:#9a9aa2;font-size:13px;vertical-align:top;">Search number</td><td style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;">' || private.html_esc(coalesce(nullif(btrim(coalesce(o.search_number, o.result->>'searchNumber')), ''), 'Not stated')) || '</td></tr>'
    || '<tr><td style="padding:6px 12px 6px 0;color:#9a9aa2;font-size:13px;vertical-align:top;">Stolen record</td><td style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;">' || private.html_esc(coalesce(v_summary, 'Stolen record returned')) || '</td></tr>'
    || '</table>'
    || '<p style="margin:0 0 12px;color:#f2f2f2;">If you choose to tell Crime Stoppers Queensland, submit it yourself at <a href="' || private.html_esc(v_report_url) || '" style="color:#d9a441;">' || private.html_esc(v_report_url) || '</a>. You can paste the text below into the form. IM DRIVN will not send this report automatically.</p>'
    || '<p style="margin:0 0 8px;color:#d9a441;font-weight:700;">Prefilled Crime Stoppers report</p>'
    || '<pre style="margin:0 0 18px;padding:14px;background:#000000;border:1px solid #222222;border-radius:10px;color:#f2f2f2;font-size:13px;line-height:1.45;white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;">' || private.html_esc(v_cs) || '</pre>'
    || '<p style="margin:0;color:#9a9aa2;font-size:13px;">Drive safe,<br><b style="color:#ffffff;">IM DRIVN</b></p>';

  v_html := private.email_shell('A PPSR search on IM DRIVN returned a stolen record for VIN ' || o.vin || '.', v_inner);
  v_text := 'Stolen vehicle alert' || E'\n\n'
    || 'A completed PPSR search on IM DRIVN returned a stolen record. This email is for you only. It has not been sent to Crime Stoppers.' || E'\n\n'
    || 'VIN: ' || o.vin || E'\n'
    || 'Order id: ' || o.id::text || E'\n'
    || 'Buyer: ' || coalesce('@' || v_username, o.email, 'Not stated') || E'\n'
    || 'Listing: ' || coalesce(v_listing_url, 'No listing attached') || E'\n'
    || 'Search number: ' || coalesce(nullif(btrim(coalesce(o.search_number, o.result->>'searchNumber')), ''), 'Not stated') || E'\n\n'
    || 'Submit to Crime Stoppers yourself (not done automatically): ' || v_report_url || E'\n\n'
    || 'Prefilled Crime Stoppers report:' || E'\n\n' || v_cs || E'\n\n'
    || 'Drive safe,' || E'\n' || 'IM DRIVN' || E'\n\n'
    || private.email_brand_footer_text();

  v_req := private.send_email(
    v_admin,
    'Stolen vehicle alert: ' || o.vin,
    v_html,
    v_text
  );
  update public.vin_alerts set email_request_id = v_req where id = v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'email_request', v_req, 'admin', v_admin, 'report_url', v_report_url);
end;
$function$;

revoke all on function public.record_vin_stolen_alert(uuid) from public, anon, authenticated;
grant execute on function public.record_vin_stolen_alert(uuid) to service_role;
