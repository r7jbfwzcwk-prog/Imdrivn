-- Welcome email subject is exactly Oh Hey! Welcome to IM DRIVN.



create or replace function private.send_welcome_email(p_email text, p_name text)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_site text := private.email_cfg('site_url', 'https://imdrivn.com.au');
  v_raw text := nullif(trim(p_name), '');
  v_name text := case
    when v_raw is null then null
    when left(v_raw, 1) = '@' then v_raw
    else '@' || v_raw
  end;
  v_subject text := 'Oh Hey! Welcome to IM DRIVN';
  v_html text;
  v_text text;
  v_lanes text;
  v_gold text := '';
  v_gold_btn text := 'display:block;padding:22px 10px;background-color:#d9a441;background-image:linear-gradient(#f3d27a,#d9a441 45%,#a87a26);border:1px solid #f7e2a6;border-bottom:4px solid #6e4f17;border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 4px 8px rgba(0,0,0,.7);text-align:center;text-decoration:none;color:#111111;';
  v_gold_text text := 'display:block;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:900;letter-spacing:0.06em;line-height:1.2;color:#111111;text-shadow:0 1px 0 rgba(255,255,255,.35);';
  v_forum_btn text := 'display:block;padding:18px 10px;background-color:#111111;background-image:linear-gradient(#2a2a2c,#0b0b0c);border:2px solid #d9a441;border-top-color:#f0c96a;border-bottom:4px solid #8a6420;border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 4px 8px rgba(0,0,0,.7);text-align:center;text-decoration:none;color:#d9a441;';
  v_forum_text text := 'display:block;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:900;letter-spacing:0.06em;line-height:1.2;color:#d9a441;text-shadow:0 1px 1px #000000;';
begin
  v_lanes :=
       '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;width:100%;">'
    || '<tr>'
    || '<td width="50%" valign="top" style="padding:0 5px 0 0;width:50%;">'
    || '<a href="' || v_site || '/#/buyin" style="' || v_gold_btn || '">'
    || '<span style="' || v_gold_text || '">IM BUYIN</span>'
    || '</a></td>'
    || '<td width="50%" valign="top" style="padding:0 0 0 5px;width:50%;">'
    || '<a href="' || v_site || '/#/sell" style="' || v_gold_btn || '">'
    || '<span style="' || v_gold_text || '">IM SELLIN</span>'
    || '</a></td>'
    || '</tr></table>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;width:100%;">'
    || '<tr><td style="padding:0;">'
    || '<a href="' || v_site || '/#/forum" style="' || v_forum_btn || '">'
    || '<span style="' || v_forum_text || '">CHECK OUT THE FORUMS</span>'
    || '</a></td></tr></table>';

  if v_name is not null then
    v_gold := '<p style="margin:0 0 18px;font-size:18px;font-weight:700;color:#d9a441;">' || private.html_esc(v_name) || '</p>';
  end if;

  v_html := private.email_shell('You''re in. Welcome to the IM DRIVN community.',
       '<h1 style="margin:0 0 6px;font-size:24px;line-height:1.25;color:#ffffff;font-weight:900;">Oh Hey !<br>Welcome to IM DRIVN</h1>'
    || v_gold
    || '<p style="margin:0 0 14px;color:#f2f2f2;">You''re now officially a part of the IM DRIVN community. It''s great to have you here!</p>'
    || '<p style="margin:0 0 18px;color:#d4d4d4;">You can start scrolling listings, post your car or check out our forums for everything from car meets to advice from like-minded car lovers.</p>'
    || '<p style="margin:0 0 18px;color:#f2f2f2;">Let''s dive straight in… what are you doing first up?</p>'
    || v_lanes
    || '<p style="margin:0;color:#9a9aa2;font-size:13px;">See you in the feed,<br><b style="color:#ffffff;">IM DRIVN</b></p>');
  v_text := 'Oh Hey !' || E'\n'
    || 'Welcome to IM DRIVN' || E'\n\n'
    || coalesce(v_name, '') || E'\n\n'
    || 'You''re now officially a part of the IM DRIVN community. It''s great to have you here!' || E'\n\n'
    || 'You can start scrolling listings, post your car or check out our forums for everything from car meets to advice from like-minded car lovers.' || E'\n\n'
    || 'Let''s dive straight in… what are you doing first up?' || E'\n\n'
    || 'IM BUYIN: ' || v_site || '/#/buyin' || E'\n'
    || 'IM SELLIN: ' || v_site || '/#/sell' || E'\n'
    || 'CHECK OUT THE FORUMS: ' || v_site || '/#/forum' || E'\n\n'
    || 'See you in the feed,' || E'\n' || 'IM DRIVN' || E'\n\n'
    || private.email_brand_footer_text();
  return private.send_email(p_email, v_subject, v_html, v_text);
exception when others then
  raise warning 'send_welcome_email failed: %', sqlerrm;
  return null;
end;
$function$;
