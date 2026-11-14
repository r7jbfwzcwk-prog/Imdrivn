-- Copy every wholesale submission to the business inbox as well as the
-- existing dealer inbox. Recipients stay in the notify function, which is
-- what valuations_email_wholesale already calls.

create or replace function private.notify_wholesale_submission()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_key text;
  c jsonb := coalesce(new.condition, '{}'::jsonb);
  v_car text;
  v_subject text;
  v_rows text := '';
  v_photos text := '';
  v_price text;
  v_body jsonb;
  p text;
  n int := 0;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_key is null then
    raise warning 'notify_wholesale_submission: resend_api_key missing';
    return new;
  end if;

  v_car := trim(concat_ws(' ', new.year::text, new.make, new.model));
  v_subject := 'New Wholesale submission: ' || coalesce(nullif(v_car,''), 'vehicle');
  v_price := case when new.expected_price is null then 'Dealers to make an offer'
                  else '$' || to_char(new.expected_price, 'FM999,999,999') || ' AUD' end;

  v_rows :=
       '<tr><td colspan="2" style="padding:12px 0 4px"><b>Vehicle</b></td></tr>'
    || private.html_row('Make', new.make) || private.html_row('Model', new.model)
    || private.html_row('Year', new.year::text) || private.html_row('Variant', new.variant)
    || private.html_row('Kms', case when new.kms is null then null else to_char(new.kms,'FM999,999,999') || ' km' end)
    || private.html_row('Rego', trim(concat_ws(' ', new.rego, c->>'rego_state')))
    || private.html_row('VIN', new.vin)
    || private.html_row('Location', concat_ws(', ', nullif(new.suburb,''), nullif(trim(concat_ws(' ', new.state, new.postcode)),'')))
    || '<tr><td colspan="2" style="padding:12px 0 4px"><b>Condition</b></td></tr>'
    || private.html_row('Exterior', c->>'exterior') || private.html_row('Interior', c->>'interior')
    || private.html_row('Accident history', case c->>'accident' when 'true' then 'Yes' when 'false' then 'No' else c->>'accident' end)
    || private.html_row('Service history', c->>'service')
    || private.html_row('Finance owing', case c->>'finance' when 'true' then 'Yes' when 'false' then 'No' else c->>'finance' end)
    || private.html_row('Keys', c->>'keys')
    || private.html_row('Mods', case c->>'mods' when 'true' then 'Yes' || coalesce(nullif(': ' || nullif(c->>'mods_note',''), ': '), '') when 'false' then 'No' else c->>'mods' end)
    || '<tr><td colspan="2" style="padding:12px 0 4px"><b>Price</b></td></tr>'
    || private.html_row('Hoping for', v_price)
    || '<tr><td colspan="2" style="padding:12px 0 4px"><b>Contact</b></td></tr>'
    || private.html_row('Name', new.contact_name) || private.html_row('Email', new.contact_email)
    || private.html_row('Phone', new.contact_phone)
    || private.html_row('Submitted', to_char(new.created_at at time zone 'Australia/Brisbane', 'DD Mon YYYY HH12:MI am') || ' (Brisbane)')
    || private.html_row('Reference', new.id::text);

  if new.photos is not null and array_length(new.photos,1) > 0 then
    foreach p in array new.photos loop
      n := n + 1;
      v_photos := v_photos || '<li><a href="https://pcrrcyopnzcszlopmmtg.supabase.co/storage/v1/object/public/listing-photos/'
        || private.html_esc(replace(replace(p,' ','%20'),'"','')) || '">Photo ' || n || '</a></li>';
    end loop;
    v_photos := '<p style="margin:16px 0 4px"><b>Photos (' || n || ')</b></p><ul>' || v_photos || '</ul>';
  else
    v_photos := '<p style="margin:16px 0 4px"><b>Photos:</b> none</p>';
  end if;

  v_body := jsonb_build_object(
    'from', private.email_cfg('from_address', 'IM DRIVN <onboarding@resend.dev>'),
    'to', jsonb_build_array('imdrivn.au@gmail.com', 'ohhey@imdrivn.com.au'),
    'subject', v_subject,
    'html', '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">'
         || '<h2 style="margin:0 0 8px">New Wholesale submission</h2>'
         || '<p style="margin:0 0 8px">' || private.html_esc(v_car) || '</p>'
         || '<table cellpadding="4" style="border-collapse:collapse">' || v_rows || '</table>'
         || v_photos
         || private.email_brand_footer('light')
         || '</div>',
    'text', 'New Wholesale submission: ' || coalesce(nullif(v_car,''), 'vehicle') || E'\n\n' || private.email_brand_footer_text()
  );
  if new.contact_email ~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    v_body := v_body || jsonb_build_object('reply_to', new.contact_email);
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    body := v_body,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  raise warning 'notify_wholesale_submission failed: %', sqlerrm;
  return new;
end;
$function$;
