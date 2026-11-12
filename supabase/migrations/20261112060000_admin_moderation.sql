-- Admin moderation. Soft-remove listings and forum posts, message users as
-- IM DRIVN Admin, and record every action. Service role and is_admin() only.

alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings
  add constraint listings_status_check
  check (status = any (array['active'::text, 'sold'::text, 'draft'::text, 'removed'::text]));

alter table public.listings
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid,
  add column if not exists removal_reason text,
  add column if not exists status_before_removal text;

alter table public.forum_threads
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid,
  add column if not exists removal_reason text;

alter table public.forum_replies
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid,
  add column if not exists removal_reason text;

drop policy if exists "read threads" on public.forum_threads;
create policy "read threads"
  on public.forum_threads
  for select
  to public
  using (removed_at is null);

drop policy if exists "admin read removed threads" on public.forum_threads;
create policy "admin read removed threads"
  on public.forum_threads
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "read replies" on public.forum_replies;
create policy "read replies"
  on public.forum_replies
  for select
  to public
  using (
    removed_at is null
    and exists (
      select 1 from public.forum_threads t
      where t.id = forum_replies.thread_id
        and t.removed_at is null
    )
  );

drop policy if exists "admin read replies" on public.forum_replies;
create policy "admin read replies"
  on public.forum_replies
  for select
  to authenticated
  using (public.is_admin());

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind = any (array['reply'::text, 'mention'::text, 'message'::text, 'moderation'::text]));

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_table text not null,
  target_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;
revoke all on table public.admin_actions from anon, authenticated;
grant select on table public.admin_actions to authenticated;
grant all on table public.admin_actions to service_role;

drop policy if exists admin_actions_read on public.admin_actions;
create policy admin_actions_read
  on public.admin_actions
  for select
  to authenticated
  using (public.is_admin());

create or replace function private.staff_actor()
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    case when public.is_admin() then auth.uid() else null end,
    (select p.id from public.profiles p where p.is_admin and lower(p.username) = 'imdrivn' limit 1),
    (select p.id from public.profiles p where p.is_admin limit 1)
  );
$function$;

revoke all on function private.staff_actor() from public;

create or replace function private.assert_staff()
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.is_admin(), false) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  v_actor := private.staff_actor();
  if v_actor is null then
    raise exception 'No admin profile is available.' using errcode = 'P0001';
  end if;
  return v_actor;
end;
$function$;

revoke all on function private.assert_staff() from public;

create or replace function private.admin_audit(
  p_actor uuid,
  p_action text,
  p_table text,
  p_target uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.admin_actions (actor_id, action, target_table, target_id, reason)
  values (p_actor, p_action, p_table, p_target, nullif(btrim(coalesce(p_reason, '')), ''));
end;
$function$;

revoke all on function private.admin_audit(uuid, text, text, uuid, text) from public;

create or replace function private.notify_moderation(
  p_user uuid,
  p_actor uuid,
  p_text text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_user is null or p_user = p_actor then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, kind, thread_title, preview)
  values (p_user, p_actor, 'moderation', 'IM DRIVN', left(p_text, 180));
end;
$function$;

revoke all on function private.notify_moderation(uuid, uuid, text) from public;

create or replace function public.admin_remove_listing(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := private.assert_staff();
  v_row public.listings%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text;
begin
  select * into v_row from public.listings where id = p_id;
  if v_row.id is null then
    raise exception 'That ad was not found.' using errcode = 'P0002';
  end if;
  if v_row.status = 'removed' then
    raise exception 'That ad is already removed.' using errcode = 'P0001';
  end if;
  update public.listings
    set status = 'removed',
        status_before_removal = v_row.status,
        removed_at = now(),
        removed_by = v_actor,
        removal_reason = coalesce(v_reason, 'No reason given.')
    where id = v_row.id;
  v_note := 'Your ad was removed by IM DRIVN admin: ' || coalesce(v_reason, 'No reason given.');
  perform private.notify_moderation(v_row.user_id, v_actor, v_note);
  perform private.admin_audit(v_actor, 'remove_listing', 'listings', v_row.id, v_reason);
  return jsonb_build_object('id', v_row.id, 'status', 'removed');
end;
$function$;

create or replace function public.admin_restore_listing(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := private.assert_staff();
  v_row public.listings%rowtype;
  v_status text;
begin
  select * into v_row from public.listings where id = p_id;
  if v_row.id is null then
    raise exception 'That ad was not found.' using errcode = 'P0002';
  end if;
  if v_row.status <> 'removed' then
    raise exception 'That ad is not removed.' using errcode = 'P0001';
  end if;
  v_status := coalesce(nullif(v_row.status_before_removal, ''), 'active');
  if v_status not in ('active', 'sold', 'draft') then
    v_status := 'active';
  end if;
  update public.listings
    set status = v_status,
        status_before_removal = null,
        removed_at = null,
        removed_by = null,
        removal_reason = null
    where id = v_row.id;
  perform private.admin_audit(v_actor, 'restore_listing', 'listings', v_row.id, null);
  return jsonb_build_object('id', v_row.id, 'status', v_status);
end;
$function$;

create or replace function public.admin_remove_forum_post(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := private.assert_staff();
  v_row public.forum_replies%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text;
begin
  select * into v_row from public.forum_replies where id = p_id;
  if v_row.id is null then
    raise exception 'That reply was not found.' using errcode = 'P0002';
  end if;
  if v_row.removed_at is not null then
    raise exception 'That reply is already removed.' using errcode = 'P0001';
  end if;
  update public.forum_replies
    set removed_at = now(),
        removed_by = v_actor,
        removal_reason = coalesce(v_reason, 'No reason given.')
    where id = v_row.id;
  v_note := 'Your post was removed by IM DRIVN admin: ' || coalesce(v_reason, 'No reason given.');
  perform private.notify_moderation(v_row.author_id, v_actor, v_note);
  perform private.admin_audit(v_actor, 'remove_forum_post', 'forum_replies', v_row.id, v_reason);
  return jsonb_build_object('id', v_row.id, 'removed', true);
end;
$function$;

create or replace function public.admin_restore_forum_post(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := private.assert_staff();
  v_row public.forum_replies%rowtype;
begin
  select * into v_row from public.forum_replies where id = p_id;
  if v_row.id is null then
    raise exception 'That reply was not found.' using errcode = 'P0002';
  end if;
  update public.forum_replies
    set removed_at = null, removed_by = null, removal_reason = null
    where id = v_row.id;
  perform private.admin_audit(v_actor, 'restore_forum_post', 'forum_replies', v_row.id, null);
  return jsonb_build_object('id', v_row.id, 'removed', false);
end;
$function$;

create or replace function public.admin_remove_forum_thread(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := private.assert_staff();
  v_row public.forum_threads%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text;
begin
  select * into v_row from public.forum_threads where id = p_id;
  if v_row.id is null then
    raise exception 'That thread was not found.' using errcode = 'P0002';
  end if;
  if v_row.removed_at is not null then
    raise exception 'That thread is already removed.' using errcode = 'P0001';
  end if;
  update public.forum_threads
    set removed_at = now(),
        removed_by = v_actor,
        removal_reason = coalesce(v_reason, 'No reason given.')
    where id = v_row.id;
  v_note := 'Your thread was removed by IM DRIVN admin: ' || coalesce(v_reason, 'No reason given.');
  perform private.notify_moderation(v_row.author_id, v_actor, v_note);
  perform private.admin_audit(v_actor, 'remove_forum_thread', 'forum_threads', v_row.id, v_reason);
  return jsonb_build_object('id', v_row.id, 'removed', true);
end;
$function$;

create or replace function public.admin_restore_forum_thread(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := private.assert_staff();
  v_row public.forum_threads%rowtype;
begin
  select * into v_row from public.forum_threads where id = p_id;
  if v_row.id is null then
    raise exception 'That thread was not found.' using errcode = 'P0002';
  end if;
  update public.forum_threads
    set removed_at = null, removed_by = null, removal_reason = null
    where id = v_row.id;
  perform private.admin_audit(v_actor, 'restore_forum_thread', 'forum_threads', v_row.id, null);
  return jsonb_build_object('id', v_row.id, 'removed', false);
end;
$function$;

create or replace function public.admin_send_message(p_user_id uuid, p_body text)
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
  select c.id into v_conv
  from public.conversations c
  where c.listing_id is null
    and c.buyer_id = p_user_id
    and c.seller_id = v_actor
  limit 1;
  if v_conv is null then
    insert into public.conversations (listing_id, buyer_id, seller_id)
    values (null, p_user_id, v_actor)
    returning id into v_conv;
  end if;
  insert into public.messages (conversation_id, sender_id, body)
  values (v_conv, v_actor, v_body)
  returning id into v_msg;
  perform private.admin_audit(v_actor, 'send_message', 'messages', v_msg, null);
  return jsonb_build_object('conversation_id', v_conv, 'message_id', v_msg);
end;
$function$;

create or replace function public.admin_search_users(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_q text := btrim(coalesce(p_query, ''));
  v_rows jsonb;
begin
  perform private.assert_staff();
  if char_length(v_q) < 2 then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(row_to_json(found)::jsonb), '[]'::jsonb) into v_rows
  from (
    select p.id, p.username, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.username ilike '%' || v_q || '%'
       or u.email ilike '%' || v_q || '%'
    order by p.username
    limit 20
  ) found;
  return v_rows;
end;
$function$;

revoke all on function public.admin_remove_listing(uuid, text) from public, anon;
revoke all on function public.admin_restore_listing(uuid) from public, anon;
revoke all on function public.admin_remove_forum_post(uuid, text) from public, anon;
revoke all on function public.admin_restore_forum_post(uuid) from public, anon;
revoke all on function public.admin_remove_forum_thread(uuid, text) from public, anon;
revoke all on function public.admin_restore_forum_thread(uuid) from public, anon;
revoke all on function public.admin_send_message(uuid, text) from public, anon;
revoke all on function public.admin_search_users(text) from public, anon;

grant execute on function public.admin_remove_listing(uuid, text) to authenticated, service_role;
grant execute on function public.admin_restore_listing(uuid) to authenticated, service_role;
grant execute on function public.admin_remove_forum_post(uuid, text) to authenticated, service_role;
grant execute on function public.admin_restore_forum_post(uuid) to authenticated, service_role;
grant execute on function public.admin_remove_forum_thread(uuid, text) to authenticated, service_role;
grant execute on function public.admin_restore_forum_thread(uuid) to authenticated, service_role;
grant execute on function public.admin_send_message(uuid, text) to authenticated, service_role;
grant execute on function public.admin_search_users(text) to authenticated, service_role;
