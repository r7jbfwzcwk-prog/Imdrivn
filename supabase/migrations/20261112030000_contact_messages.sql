-- Contact form messages from About DRIVN.
-- Anon and signed-in visitors insert only (RLS). Nobody reads except admins.
-- Mail goes to private.email_config admin_email via private.send_email,
-- from the configured IM DRIVN address, reply_to the submitter.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  user_id uuid,
  ip text,
  email_request_id bigint,
  created_at timestamptz not null default now(),
  constraint contact_messages_name_len check (char_length(btrim(name)) between 2 and 80),
  constraint contact_messages_email_format check (email ~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  constraint contact_messages_topic check (topic in ('General', 'Sellin', 'Buyin', 'Report a listing', 'Partnerships', 'Other')),
  constraint contact_messages_message_len check (char_length(btrim(message)) between 8 and 2000)
);

comment on table public.contact_messages is
  'About page contact form. Insert-only for anon and authenticated. Admins can read. No public read.';

create index if not exists contact_messages_email_created_idx
  on public.contact_messages (email, created_at desc);

create index if not exists contact_messages_ip_created_idx
  on public.contact_messages (ip, created_at desc);

alter table public.contact_messages enable row level security;

revoke all on table public.contact_messages from anon, authenticated;
grant insert on table public.contact_messages to anon, authenticated;
grant select on table public.contact_messages to authenticated;
grant all on table public.contact_messages to service_role;

drop policy if exists contact_messages_insert on public.contact_messages;
create policy contact_messages_insert
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(name)) between 2 and 80
    and email ~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    and topic in ('General', 'Sellin', 'Buyin', 'Report a listing', 'Partnerships', 'Other')
    and char_length(btrim(message)) between 8 and 2000
    and (user_id is null or user_id = (select auth.uid()))
  );

drop policy if exists contact_messages_admin_read on public.contact_messages;
create policy contact_messages_admin_read
  on public.contact_messages
  for select
  to authenticated
  using (public.is_admin());

create or replace function private.contact_message_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_headers text;
  v_ip text;
  v_recent int;
begin
  new.name := btrim(coalesce(new.name, ''));
  new.email := lower(btrim(coalesce(new.email, '')));
  new.topic := btrim(coalesce(new.topic, ''));
  new.message := btrim(coalesce(new.message, ''));
  new.user_id := auth.uid();
  new.created_at := now();
  new.email_request_id := null;

  if char_length(new.name) < 2 or char_length(new.name) > 80 then
    raise exception 'Add your name.' using errcode = '22023';
  end if;
  if new.email !~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Add a valid email.' using errcode = '22023';
  end if;
  if new.topic not in ('General', 'Sellin', 'Buyin', 'Report a listing', 'Partnerships', 'Other') then
    raise exception 'Choose a topic.' using errcode = '22023';
  end if;
  if char_length(new.message) < 8 or char_length(new.message) > 2000 then
    raise exception 'Add a short message.' using errcode = '22023';
  end if;

  v_ip := null;
  begin
    v_headers := current_setting('request.headers', true);
    if v_headers is not null and v_headers <> '' then
      v_ip := nullif(btrim(split_part(coalesce(
        (v_headers::json->>'cf-connecting-ip'),
        (v_headers::json->>'x-real-ip'),
        (v_headers::json->>'x-forwarded-for'),
        ''
      ), ',', 1)), '');
    end if;
  exception when others then
    v_ip := null;
  end;
  new.ip := left(v_ip, 64);

  select count(*)::int into v_recent
  from public.contact_messages cm
  where cm.created_at > now() - interval '1 hour'
    and lower(cm.email) = new.email;
  if coalesce(v_recent, 0) >= 3 then
    raise exception 'Too many messages. Please try again later.' using errcode = 'P0001';
  end if;

  if new.ip is not null then
    select count(*)::int into v_recent
    from public.contact_messages cm
    where cm.created_at > now() - interval '1 hour'
      and cm.ip = new.ip;
    if coalesce(v_recent, 0) >= 10 then
      raise exception 'Too many messages. Please try again later.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.contact_message_guard() from public;

drop trigger if exists contact_messages_guard on public.contact_messages;
create trigger contact_messages_guard
  before insert on public.contact_messages
  for each row
  execute function private.contact_message_guard();

create or replace function private.contact_message_notify()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_to text;
  v_when text;
  v_rows text;
  v_html text;
  v_text text;
  v_req bigint;
begin
  v_to := nullif(btrim(coalesce(private.email_cfg('admin_email', 'imdrivn.au@gmail.com'), '')), '');
  if v_to is null then
    return new;
  end if;
  v_when := to_char(new.created_at at time zone 'Australia/Brisbane', 'DD Mon YYYY HH12:MI am') || ' (Brisbane)';
  v_rows :=
       private.html_row('Name', new.name)
    || private.html_row('Email', new.email)
    || private.html_row('Topic', new.topic)
    || private.html_row('Message', new.message)
    || private.html_row('Submitted', v_when)
    || private.html_row('Reference', new.id::text);
  v_html :=
       '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">'
    || '<h2 style="margin:0 0 8px">New contact message</h2>'
    || '<table cellpadding="4" style="border-collapse:collapse">' || v_rows || '</table>'
    || private.email_brand_footer('light')
    || '</div>';
  v_text :=
       'New contact message' || E'\n\n'
    || 'Name: ' || new.name || E'\n'
    || 'Email: ' || new.email || E'\n'
    || 'Topic: ' || new.topic || E'\n'
    || 'Message: ' || new.message || E'\n'
    || 'Submitted: ' || v_when || E'\n'
    || 'Reference: ' || new.id::text || E'\n\n'
    || private.email_brand_footer_text();
  v_req := private.send_email(
    v_to,
    'New contact message: ' || new.topic,
    v_html,
    v_text,
    new.email
  );
  update public.contact_messages
    set email_request_id = v_req
    where id = new.id;
  return new;
exception when others then
  raise warning 'contact_message_notify failed: %', sqlerrm;
  return new;
end;
$function$;

revoke all on function private.contact_message_notify() from public;

drop trigger if exists contact_messages_notify on public.contact_messages;
create trigger contact_messages_notify
  after insert on public.contact_messages
  for each row
  execute function private.contact_message_notify();

create schema if not exists app_contact;

revoke all on schema app_contact from public;
grant usage on schema app_contact to anon, authenticated, service_role;

comment on schema app_contact is
  'Unexposed contact gateway schema. Holds the SECURITY DEFINER entrypoint only.';

create or replace function private.submit_contact_message(
  p_name text,
  p_email text,
  p_topic text,
  p_message text,
  p_company text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_created timestamptz;
  v_req bigint;
begin
  if nullif(btrim(coalesce(p_company, '')), '') is not null then
    return jsonb_build_object('saved', true, 'email_queued', false);
  end if;

  insert into public.contact_messages (name, email, topic, message)
  values (p_name, p_email, p_topic, p_message)
  returning id, created_at into v_id, v_created;

  select cm.email_request_id into v_req
  from public.contact_messages cm
  where cm.id = v_id;

  return jsonb_build_object(
    'id', v_id,
    'created_at', v_created,
    'saved', true,
    'email_queued', v_req is not null,
    'email_request_id', v_req
  );
end;
$function$;

revoke all on function private.submit_contact_message(text, text, text, text, text) from public;

create or replace function app_contact.submit_contact_message(
  p_name text,
  p_email text,
  p_topic text,
  p_message text,
  p_company text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  return private.submit_contact_message(p_name, p_email, p_topic, p_message, p_company);
end;
$function$;

revoke all on function app_contact.submit_contact_message(text, text, text, text, text) from public;
grant execute on function app_contact.submit_contact_message(text, text, text, text, text)
  to anon, authenticated, service_role;

create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_topic text,
  p_message text,
  p_company text
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  return app_contact.submit_contact_message(p_name, p_email, p_topic, p_message, p_company);
end;
$function$;

revoke all on function public.submit_contact_message(text, text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text, text)
  to anon, authenticated, service_role;

comment on function public.submit_contact_message(text, text, text, text, text) is
  'SECURITY INVOKER public RPC. Delegates to app_contact.submit_contact_message.';
