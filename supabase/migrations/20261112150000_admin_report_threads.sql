-- Link admin support threads to ad reports and contact reports.
-- admin_send_message keeps the original two arguments. p_report_id is optional and defaults to null.

alter table public.conversations
  add column if not exists report_kind text,
  add column if not exists report_id uuid;

alter table public.conversations
  drop constraint if exists conversations_report_kind_check;
alter table public.conversations
  add constraint conversations_report_kind_check
  check (report_kind is null or report_kind in ('ad_report', 'contact'));

alter table public.conversations
  drop constraint if exists conversations_report_pair_check;
alter table public.conversations
  add constraint conversations_report_pair_check
  check ((report_kind is null) = (report_id is null));

create index if not exists conversations_report_idx
  on public.conversations (report_kind, report_id)
  where report_id is not null;

alter table public.contact_messages
  add column if not exists status text not null default 'open';

alter table public.contact_messages
  drop constraint if exists contact_messages_status_check;
alter table public.contact_messages
  add constraint contact_messages_status_check
  check (status in ('open', 'reviewed'));

revoke update on table public.contact_messages from anon, authenticated;
grant update (status) on table public.contact_messages to authenticated;

drop policy if exists contact_messages_admin_update on public.contact_messages;
create policy contact_messages_admin_update
  on public.contact_messages
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin() and status in ('open', 'reviewed'));

create or replace function public.contact_messages_freeze()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.id is distinct from old.id
     or new.name is distinct from old.name
     or new.email is distinct from old.email
     or new.topic is distinct from old.topic
     or new.message is distinct from old.message
     or new.user_id is distinct from old.user_id
     or new.ip is distinct from old.ip
     or new.email_request_id is distinct from old.email_request_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the status can be changed';
  end if;
  return new;
end;
$function$;

drop trigger if exists contact_messages_freeze on public.contact_messages;
create trigger contact_messages_freeze
  before update on public.contact_messages
  for each row execute function public.contact_messages_freeze();

drop policy if exists conversations_admin_read_reports on public.conversations;
create policy conversations_admin_read_reports
  on public.conversations
  for select
  to authenticated
  using (public.is_admin() and report_id is not null);

drop policy if exists messages_admin_read_reports on public.messages;
create policy messages_admin_read_reports
  on public.messages
  for select
  to authenticated
  using (
    public.is_admin()
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.report_id is not null
    )
  );

-- Best-effort: attach an existing admin support thread when the reporter or
-- the seller is the buyer, and the listing is named in that thread.
with admin as (
  select p.id
  from public.profiles p
  where p.is_admin and lower(p.username) = 'imdrivn'
  limit 1
), candidates as (
  select c.id as conv_id, r.id as report_id,
    row_number() over (
      partition by c.id
      order by abs(extract(epoch from (c.created_at - r.created_at)))
    ) as rn
  from public.conversations c
  join admin a on a.id = c.seller_id
  join public.ad_reports r on c.buyer_id = r.reporter_id
    or c.buyer_id = (select l.user_id from public.listings l where l.id = r.listing_id)
  join public.listings l on l.id = r.listing_id
  where c.listing_id is null
    and c.report_id is null
    and exists (
      select 1
      from public.messages m
      where m.conversation_id = c.id
        and (
          position(l.id::text in m.body) > 0
          or (
            char_length(btrim(coalesce(l.heading, ''))) >= 4
            and position(lower(btrim(l.heading)) in lower(m.body)) > 0
          )
        )
    )
)
update public.conversations c
set report_kind = 'ad_report', report_id = candidates.report_id
from candidates
where c.id = candidates.conv_id
  and candidates.rn = 1
  and c.report_id is null;

with admin as (
  select p.id
  from public.profiles p
  where p.is_admin and lower(p.username) = 'imdrivn'
  limit 1
), candidates as (
  select c.id as conv_id, cm.id as report_id,
    row_number() over (
      partition by c.id
      order by abs(extract(epoch from (c.created_at - cm.created_at)))
    ) as rn
  from public.conversations c
  join admin a on a.id = c.seller_id
  join public.contact_messages cm on cm.user_id = c.buyer_id
  where c.listing_id is null
    and c.report_id is null
    and (
      cm.topic = 'Report a listing'
      or cm.message ~* 'abuse|suspicious'
    )
    and exists (
      select 1
      from public.messages m
      where m.conversation_id = c.id
        and (
          position(lower(left(btrim(cm.message), 40)) in lower(m.body)) > 0
          or position(cm.id::text in m.body) > 0
        )
    )
)
update public.conversations c
set report_kind = 'contact', report_id = candidates.report_id
from candidates
where c.id = candidates.conv_id
  and candidates.rn = 1
  and c.report_id is null;

drop function if exists public.admin_send_message(uuid, text);

create or replace function public.admin_send_message(
  p_user_id uuid,
  p_body text,
  p_report_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := private.assert_staff();
  v_body text := btrim(coalesce(p_body, ''));
  v_conv uuid;
  v_msg uuid;
  v_kind text;
begin
  if p_user_id is null or p_user_id = v_actor then
    raise exception 'Choose someone else to message.' using errcode = '22023';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'Write a message between 1 and 2000 characters.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'That person was not found.' using errcode = 'P0002';
  end if;
  if p_report_id is not null then
    if exists (select 1 from public.ad_reports r where r.id = p_report_id) then
      v_kind := 'ad_report';
    elsif exists (select 1 from public.contact_messages cm where cm.id = p_report_id) then
      v_kind := 'contact';
    else
      raise exception 'That report was not found.' using errcode = 'P0002';
    end if;
  end if;
  if p_report_id is null then
    select c.id into v_conv
    from public.conversations c
    where c.listing_id is null
      and c.buyer_id = p_user_id
      and c.seller_id = v_actor
    limit 1;
  else
    select c.id into v_conv
    from public.conversations c
    where c.listing_id is null
      and c.buyer_id = p_user_id
      and c.seller_id = v_actor
      and c.report_id = p_report_id
    limit 1;
    if v_conv is null then
      select c.id into v_conv
      from public.conversations c
      where c.listing_id is null
        and c.buyer_id = p_user_id
        and c.seller_id = v_actor
        and c.report_id is null
      limit 1;
      if v_conv is not null then
        update public.conversations
          set report_kind = v_kind, report_id = p_report_id
          where id = v_conv;
      end if;
    end if;
  end if;
  if v_conv is null then
    insert into public.conversations (listing_id, buyer_id, seller_id, report_kind, report_id)
    values (null, p_user_id, v_actor, v_kind, p_report_id)
    returning id into v_conv;
  end if;
  insert into public.messages (conversation_id, sender_id, body)
  values (v_conv, v_actor, v_body)
  returning id into v_msg;
  perform private.admin_audit(v_actor, 'send_message', 'messages', v_msg, null);
  if p_report_id is not null then
    perform private.admin_audit(v_actor, 'send_message', v_kind, p_report_id, null);
  end if;
  return jsonb_build_object('conversation_id', v_conv, 'message_id', v_msg);
end;
$function$;

revoke all on function public.admin_send_message(uuid, text, uuid) from public, anon;
grant execute on function public.admin_send_message(uuid, text, uuid) to authenticated, service_role;

create or replace function public.admin_report_queue(p_status text default 'open')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_status text := lower(btrim(coalesce(p_status, 'open')));
  v_rows jsonb;
begin
  perform private.assert_staff();
  if v_status not in ('open', 'reviewed', 'all') then
    v_status := 'open';
  end if;
  select coalesce(jsonb_agg(row_to_json(found)::jsonb order by found.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select 'ad'::text as kind, r.id, r.status, r.reason,
      r.listing_id,
      coalesce(nullif(l.heading, ''), concat_ws(' ', l.year::text, l.make, l.model), 'Listing') as listing_title,
      nullif(pr.username, '') as reporter,
      r.reporter_id,
      l.user_id as seller_id,
      r.created_at
    from public.ad_reports r
    left join public.listings l on l.id = r.listing_id
    left join public.profiles pr on pr.id = r.reporter_id
    where v_status = 'all' or r.status = v_status
    union all
    select 'contact'::text, cm.id, cm.status,
      case
        when cm.topic = 'Report a listing' then 'Report a listing'
        else 'Abuse / suspicious'
      end,
      null::uuid,
      null::text,
      coalesce(nullif(pr.username, ''), nullif(cm.name, '')),
      cm.user_id,
      null::uuid as seller_id,
      cm.created_at
    from public.contact_messages cm
    left join public.profiles pr on pr.id = cm.user_id
    where (cm.topic = 'Report a listing' or cm.message ~* 'abuse|suspicious')
      and (v_status = 'all' or cm.status = v_status)
  ) found;
  return v_rows;
end;
$function$;

revoke all on function public.admin_report_queue(text) from public, anon;
grant execute on function public.admin_report_queue(text) to authenticated, service_role;

create or replace function public.admin_report_detail(p_kind text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_report record;
  v_threads jsonb;
  v_actions jsonb;
begin
  perform private.assert_staff();
  if v_kind = 'ad' then
    select r.id, r.status, r.reason, coalesce(r.details, '') as details, r.created_at,
      r.listing_id,
      coalesce(nullif(l.heading, ''), concat_ws(' ', l.year::text, l.make, l.model), 'Listing') as listing_title,
      r.reporter_id,
      nullif(pr.username, '') as reporter_handle,
      nullif(ru.email, '') as reporter_email,
      l.user_id as seller_id,
      nullif(ps.username, '') as seller_handle
    into v_report
    from public.ad_reports r
    left join public.listings l on l.id = r.listing_id
    left join public.profiles pr on pr.id = r.reporter_id
    left join auth.users ru on ru.id = r.reporter_id
    left join public.profiles ps on ps.id = l.user_id
    where r.id = p_id;
  elsif v_kind = 'contact' then
    select cm.id, cm.status,
      case when cm.topic = 'Report a listing' then 'Report a listing' else 'Abuse / suspicious' end as reason,
      cm.message as details,
      cm.created_at,
      listed.id as listing_id,
      coalesce(listed.title, '') as listing_title,
      cm.user_id as reporter_id,
      coalesce(nullif(pr.username, ''), nullif(cm.name, '')) as reporter_handle,
      nullif(cm.email, '') as reporter_email,
      listed.seller_id,
      nullif(ps.username, '') as seller_handle
    into v_report
    from public.contact_messages cm
    left join public.profiles pr on pr.id = cm.user_id
    left join lateral (
      select l.id, l.user_id as seller_id,
        coalesce(nullif(l.heading, ''), concat_ws(' ', l.year::text, l.make, l.model), 'Listing') as title
      from public.listings l
      where position(l.id::text in cm.message) > 0
         or (
           char_length(btrim(coalesce(l.heading, ''))) >= 4
           and position(lower(btrim(l.heading)) in lower(cm.message)) > 0
         )
      order by (position(l.id::text in cm.message) > 0) desc, l.created_at desc
      limit 1
    ) listed on true
    left join public.profiles ps on ps.id = listed.seller_id
    where cm.id = p_id
      and (cm.topic = 'Report a listing' or cm.message ~* 'abuse|suspicious');
  else
    raise exception 'Unknown report.' using errcode = '22023';
  end if;
  if v_report.id is null then
    raise exception 'That report was not found.' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(thread.payload order by thread.opened), '[]'::jsonb)
    into v_threads
  from (
    select c.created_at as opened,
      jsonb_build_object(
        'role', case
          when v_report.reporter_id is not null and c.buyer_id = v_report.reporter_id then 'reporter'
          when v_report.seller_id is not null and c.buyer_id = v_report.seller_id then 'seller'
          else 'other'
        end,
        'conversation_id', c.id,
        'handle', nullif(bp.username, ''),
        'messages', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', m.id,
            'sender_id', m.sender_id,
            'sender', coalesce(nullif(sp.username, ''), 'IM DRIVN'),
            'body', m.body,
            'created_at', m.created_at
          ) order by m.created_at)
          from public.messages m
          left join public.profiles sp on sp.id = m.sender_id
          where m.conversation_id = c.id
        ), '[]'::jsonb)
      ) as payload
    from public.conversations c
    left join public.profiles bp on bp.id = c.buyer_id
    where c.report_id = v_report.id
      and c.report_kind = case when v_kind = 'ad' then 'ad_report' else 'contact' end
  ) thread;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'action', a.action,
    'target_table', a.target_table,
    'target_id', a.target_id,
    'reason', a.reason,
    'created_at', a.created_at
  ) order by a.created_at), '[]'::jsonb)
    into v_actions
  from public.admin_actions a
  where a.target_id = v_report.id
     or a.target_id in (
       select m.id
       from public.messages m
       join public.conversations c on c.id = m.conversation_id
       where c.report_id = v_report.id
         and c.report_kind = case when v_kind = 'ad' then 'ad_report' else 'contact' end
     );
  return jsonb_build_object(
    'kind', v_kind,
    'id', v_report.id,
    'status', v_report.status,
    'reason', v_report.reason,
    'details', v_report.details,
    'created_at', v_report.created_at,
    'listing_id', v_report.listing_id,
    'listing_title', v_report.listing_title,
    'reporter_id', v_report.reporter_id,
    'reporter_handle', v_report.reporter_handle,
    'reporter_email', v_report.reporter_email,
    'seller_id', v_report.seller_id,
    'seller_handle', v_report.seller_handle,
    'threads', v_threads,
    'actions', v_actions
  );
end;
$function$;

revoke all on function public.admin_report_detail(text, uuid) from public, anon;
grant execute on function public.admin_report_detail(text, uuid) to authenticated, service_role;

create or replace function public.admin_review_contact_report(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := private.assert_staff();
begin
  update public.contact_messages
    set status = 'reviewed'
    where id = p_id
      and status = 'open'
      and (topic = 'Report a listing' or message ~* 'abuse|suspicious');
  if not found then
    raise exception 'That report was not found.' using errcode = 'P0002';
  end if;
  perform private.admin_audit(v_actor, 'review_report', 'contact', p_id, null);
  return jsonb_build_object('id', p_id, 'status', 'reviewed');
end;
$function$;

revoke all on function public.admin_review_contact_report(uuid) from public, anon;
grant execute on function public.admin_review_contact_report(uuid) to authenticated, service_role;
