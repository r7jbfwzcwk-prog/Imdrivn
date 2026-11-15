-- Welcome email footer matches the site footer: social PNGs, then the legal links.

create or replace function private.email_brand_footer(p_variant text default 'dark')
returns text
language sql
stable
security definer
set search_path to ''
as $function$
select case
  when lower(coalesce(p_variant, 'dark')) = 'light' then
    '<p style="margin:20px 0 0;padding-top:12px;border-top:1px solid #dddddd;font-size:12px;line-height:1.5;color:#666666;">IM DRIVN · More than a Marketplace, It''s a Community.<br><a href="' || private.email_cfg('site_url', 'https://imdrivn.com.au') || '" style="color:#666666;text-decoration:none;">imdrivn.com.au</a></p>'
  else
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;width:100%;background:#000000;">'
    || '<tr><td align="center" style="padding:0 0 14px;background:#000000;">'
    || '<a href="https://instagram.com/imdrivn" target="_blank" rel="noopener" style="display:inline-block;padding:0 10px;text-decoration:none;"><img src="https://imdrivn.com.au/img/email/instagram.png" width="22" height="22" alt="Instagram" style="display:block;width:22px;height:22px;border:0;outline:none;text-decoration:none;" /></a>'
    || '<a href="https://tiktok.com/@imdrivn" target="_blank" rel="noopener" style="display:inline-block;padding:0 10px;text-decoration:none;"><img src="https://imdrivn.com.au/img/email/tiktok.png" width="22" height="22" alt="TikTok" style="display:block;width:22px;height:22px;border:0;outline:none;text-decoration:none;" /></a>'
    || '<a href="https://www.youtube.com/@DRIVNDAILY" target="_blank" rel="noopener" style="display:inline-block;padding:0 10px;text-decoration:none;"><img src="https://imdrivn.com.au/img/email/youtube.png" width="22" height="22" alt="YouTube" style="display:block;width:22px;height:22px;border:0;outline:none;text-decoration:none;" /></a>'
    || '</td></tr>'
    || '<tr><td align="center" style="padding:0 0 14px;background:#000000;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.2;">'
    || '<a href="' || private.email_cfg('site_url', 'https://imdrivn.com.au') || '/terms.html" style="color:#9a9aa2;text-decoration:none;">Terms &amp; Conditions</a>'
    || '<span style="color:#d9a441;padding:0 8px;">|</span>'
    || '<a href="' || private.email_cfg('site_url', 'https://imdrivn.com.au') || '/privacy.html" style="color:#9a9aa2;text-decoration:none;">Privacy Policy</a>'
    || '<span style="color:#d9a441;padding:0 8px;">|</span>'
    || '<a href="' || private.email_cfg('site_url', 'https://imdrivn.com.au') || '/#/about/contact" style="color:#9a9aa2;text-decoration:none;">Contact us</a>'
    || '</td></tr>'
    || '<tr><td align="center" style="background:#000000;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#9a9aa2;">'
    || 'IM DRIVN · More than a Marketplace, It''s a Community.<br>'
    || '<a href="' || private.email_cfg('site_url', 'https://imdrivn.com.au') || '" style="color:#d9a441;text-decoration:none;">imdrivn.com.au</a>'
    || '</td></tr></table>'
end
$function$;

create or replace function private.email_brand_footer_text()
returns text
language sql
immutable
set search_path to ''
as $function$
select E'Instagram: https://instagram.com/imdrivn\nTikTok: https://tiktok.com/@imdrivn\nYouTube: https://www.youtube.com/@DRIVNDAILY\n\nTerms & Conditions: https://imdrivn.com.au/terms.html\nPrivacy Policy: https://imdrivn.com.au/privacy.html\nContact us: https://imdrivn.com.au/#/about/contact\n\nIM DRIVN · More than a Marketplace, It''s a Community.\nimdrivn.com.au'
$function$;

create or replace function private.email_shell(p_preheader text, p_inner text)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
select
 '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>'
 || '<body style="margin:0;padding:0;background:#000000;">'
 || '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#000000">' || private.html_esc(p_preheader) || '</div>'
 || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:28px 12px;background:#000000;">'
 || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#0d0d0d;border:1px solid #222222;border-radius:16px;">'
 || '<tr><td height="4" style="background:#d9a441;font-size:0;line-height:0;border-radius:16px 16px 0 0;">&nbsp;</td></tr>'
 || '<tr><td align="center" style="padding:28px 24px 8px;background:#0d0d0d;">'
 || '<a href="' || private.email_cfg('site_url', 'https://imdrivn.com.au') || '" style="text-decoration:none;">'
 || '<img src="https://cdn.jsdelivr.net/gh/r7jbfwzcwk-prog/Imdrivn@main/img/logo-wordmark.png" width="300" alt="IM DRIVN" style="display:block;width:300px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />'
 || '</a></td></tr>'
 || '<tr><td style="padding:12px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#f2f2f2;background:#0d0d0d;">' || p_inner || '</td></tr>'
 || '<tr><td style="padding:16px 28px 24px;border-top:1px solid #222222;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#9a9aa2;background:#000000;text-align:center;">' || private.email_brand_footer('dark') || '</td></tr>'
 || '</table></td></tr></table></body></html>'
$function$;
