-- 7-day unsold reminder. The hourly job is created inactive.
-- Turn it on with:
--   select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'imdrivn-unsold-7d'), active := true);
-- It only looks at active listings created 7 to 14 days ago, and each listing is emailed once.

create table if not exists private.unsold_reminders (
  listing_id uuid primary key,
  user_id uuid not null,
  email text not null,
  request_id bigint,
  sent_at timestamptz not null default now()
);

revoke all on table private.unsold_reminders from public, anon, authenticated;

create or replace function private.send_unsold_reminder(
  p_email text,
  p_username text,
  p_listing_id uuid,
  p_title text,
  p_photo text
)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_site text := private.email_cfg('site_url', 'https://imdrivn.com.au');
  v_raw text := nullif(trim(p_username), '');
  v_name text := case
    when v_raw is null then null
    when left(v_raw, 1) = '@' then v_raw
    else '@' || v_raw
  end;
  v_title text := coalesce(nullif(trim(p_title), ''), 'your car');
  v_car text := v_site || '/#/car/' || p_listing_id::text;
  v_boost text := v_site || '/#/boost/' || p_listing_id::text;
  v_top text := v_site || '/#/top/' || p_listing_id::text;
  v_photo text := nullif(trim(p_photo), '');
  v_subject text := '7 days and not sold yet';
  v_html text;
  v_text text;
  v_gold text := '';
  v_shot text := '';
  v_gold_btn text := 'display:block;padding:22px 10px;background-color:#d9a441;background-image:linear-gradient(#f3d27a,#d9a441 45%,#a87a26);border:1px solid #f7e2a6;border-bottom:4px solid #6e4f17;border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 4px 8px rgba(0,0,0,.7);text-align:center;text-decoration:none;color:#111111;';
  v_gold_text text := 'display:block;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:900;letter-spacing:0.06em;line-height:1.2;color:#111111;text-shadow:0 1px 0 rgba(255,255,255,.35);';
  v_dark_btn text := 'display:block;padding:18px 10px;background-color:#111111;background-image:linear-gradient(#2a2a2c,#0b0b0c);border:2px solid #d9a441;border-top-color:#f0c96a;border-bottom:4px solid #8a6420;border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 4px 8px rgba(0,0,0,.7);text-align:center;text-decoration:none;color:#d9a441;';
  v_dark_text text := 'display:block;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:900;letter-spacing:0.06em;line-height:1.2;color:#d9a441;text-shadow:0 1px 1px #000000;';
begin
  if v_photo is not null and v_photo !~* '^https?://' then
    v_photo := 'https://pcrrcyopnzcszlopmmtg.supabase.co/storage/v1/object/public/listing-photos/' || v_photo;
  end if;
  if v_name is not null then
    v_gold := '<p style="margin:0 0 18px;font-size:18px;font-weight:700;color:#d9a441;">' || private.html_esc(v_name) || '</p>';
  end if;
  if v_photo is not null then
    v_shot := '<a href="' || v_car || '" style="text-decoration:none;"><img src="' || private.html_esc(v_photo) || '" alt="' || private.html_esc(v_title) || '" width="464" style="display:block;width:100%;max-width:464px;height:auto;border:0;border-radius:12px;margin:0 0 14px;" /></a>';
  end if;
  v_html := private.email_shell('Your ad has been up for 7 days. Boost it free, or make it a Top Ad.',
       '<h1 style="margin:0 0 6px;font-size:24px;line-height:1.25;color:#ffffff;font-weight:900;">7 days and not sold yet</h1>'
    || v_gold
    || '<p style="margin:0 0 14px;color:#f2f2f2;">Your <a href="' || v_car || '" style="color:#ffffff;text-decoration:none;font-weight:700;">' || private.html_esc(v_title) || '</a> has been up for 7 days and it still hasn''t sold. All good. Let''s get more eyes on it.</p>'
    || v_shot
    || '<p style="margin:0 0 8px;color:#ffffff;font-weight:700;">1) Free Boost</p>'
    || '<p style="margin:0 0 14px;color:#d4d4d4;">Every seller gets 1 free boost a week. It pops your ad back to the top of the feeds.</p>'
    || '<p style="margin:0 0 18px;"><a href="' || v_boost || '" style="' || v_gold_btn || '"><span style="' || v_gold_text || '">BOOST MY AD</span></a></p>'
    || '<p style="margin:0 0 8px;color:#ffffff;font-weight:700;">2) Top Ad</p>'
    || '<p style="margin:0 0 14px;color:#d4d4d4;">Want it sitting above everyone on IM BUYIN? A Top Ad stays pinned up there.</p>'
    || '<p style="margin:0 0 18px;"><a href="' || v_top || '" style="' || v_dark_btn || '"><span style="' || v_dark_text || '">MAKE IT A TOP AD</span></a></p>'
    || '<p style="margin:0;color:#9a9aa2;font-size:13px;">You''ve got this,<br><b style="color:#ffffff;">IM DRIVN</b></p>');
  v_text := '7 days and not sold yet' || E'\n\n'
    || coalesce(v_name, '') || E'\n\n'
    || 'Your ' || v_title || ' has been up for 7 days and it still hasn''t sold. All good. Let''s get more eyes on it.' || E'\n'
    || v_car || E'\n\n'
    || '1) Free Boost' || E'\n'
    || 'Every seller gets 1 free boost a week. It pops your ad back to the top of the feeds.' || E'\n'
    || 'BOOST MY AD: ' || v_boost || E'\n\n'
    || '2) Top Ad' || E'\n'
    || 'Want it sitting above everyone on IM BUYIN? A Top Ad stays pinned up there.' || E'\n'
    || 'MAKE IT A TOP AD: ' || v_top || E'\n\n'
    || 'You''ve got this,' || E'\n' || 'IM DRIVN' || E'\n\n'
    || private.email_brand_footer_text();
  return private.send_email(p_email, v_subject, v_html, v_text);
exception when others then
  raise warning 'send_unsold_reminder failed: %', sqlerrm;
  return null;
end;
$function$;

create or replace function private.run_unsold_reminders()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r record;
  v_id bigint;
  n int := 0;
begin
  for r in
    select l.id, l.user_id, l.heading, l.photos[1] as photo, u.email, nullif(trim(p.username), '') as username
    from public.listings l
    join auth.users u on u.id = l.user_id
    left join public.profiles p on p.id = l.user_id
    where l.status = 'active'
      and l.created_at <= now() - interval '7 days'
      and l.created_at > now() - interval '14 days'
      and u.email is not null
      and not exists (select 1 from private.unsold_reminders s where s.listing_id = l.id)
    order by l.created_at
    limit 50
  loop
    begin
      v_id := private.send_unsold_reminder(r.email, r.username, r.id, r.heading, r.photo);
      insert into private.unsold_reminders(listing_id, user_id, email, request_id)
      values (r.id, r.user_id, r.email, v_id)
      on conflict (listing_id) do nothing;
      n := n + 1;
    exception when others then
      raise warning 'run_unsold_reminders row % failed: %', r.id, sqlerrm;
    end;
  end loop;
  return n;
exception when others then
  raise warning 'run_unsold_reminders failed: %', sqlerrm;
  return n;
end;
$function$;

do $cron$
declare
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'imdrivn-unsold-7d';
  if v_id is null then
    v_id := cron.schedule('imdrivn-unsold-7d', '25 * * * *', 'select private.run_unsold_reminders()');
  end if;
  perform cron.alter_job(v_id, null, null, null, null, false);
end
$cron$;
