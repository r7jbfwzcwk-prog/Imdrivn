-- Admin-only user bans. Writes go through security-definer RPCs that
-- require is_admin(). A ban blocks new forum posts, ad edits, messages,
-- and likes. Browsing stays open. Expired bans stop applying on their own.

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  banned_until timestamptz,
  reason text,
  banned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references public.profiles (id) on delete set null,
  constraint user_bans_reason_len check (reason is null or char_length(reason) <= 500)
);

create index if not exists user_bans_user_created_idx
  on public.user_bans (user_id, created_at desc);

create index if not exists user_bans_open_idx
  on public.user_bans (user_id)
  where lifted_at is null;

alter table public.user_bans enable row level security;

revoke all on table public.user_bans from anon, authenticated;
grant select on table public.user_bans to authenticated;
grant all on table public.user_bans to service_role;

drop policy if exists user_bans_read on public.user_bans;
create policy user_bans_read
  on public.user_bans
  for select
  to authenticated
  using ((user_id = (select auth.uid())) or public.is_admin());

create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    not coalesce(public.is_admin(), false)
    and exists (
      select 1
      from public.user_bans b
      where b.user_id = auth.uid()
        and b.lifted_at is null
        and (b.banned_until is null or b.banned_until > now())
    );
$function$;

revoke all on function public.is_banned() from public, anon;
grant execute on function public.is_banned() to authenticated, service_role;

create or replace function public.my_ban()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_until timestamptz;
begin
  if auth.uid() is null or coalesce(public.is_admin(), false) then
    return jsonb_build_object('banned', false);
  end if;
  select b.banned_until into v_until
  from public.user_bans b
  where b.user_id = auth.uid()
    and b.lifted_at is null
    and (b.banned_until is null or b.banned_until > now())
  order by b.created_at desc
  limit 1;
  if not found then
    return jsonb_build_object('banned', false);
  end if;
  return jsonb_build_object(
    'banned', true,
    'until', v_until,
    'indefinite', v_until is null
  );
end;
$function$;

revoke all on function public.my_ban() from public, anon;
grant execute on function public.my_ban() to authenticated, service_role;

create or replace function public.admin_ban_status(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_until timestamptz;
  v_reason text;
  v_admin boolean;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  select p.is_admin into v_admin
  from public.profiles p
  where p.id = p_user_id;
  if v_admin is null then
    raise exception 'That user was not found.' using errcode = 'P0002';
  end if;
  if v_admin then
    return jsonb_build_object('banned', false, 'admin', true);
  end if;
  select b.banned_until, b.reason into v_until, v_reason
  from public.user_bans b
  where b.user_id = p_user_id
    and b.lifted_at is null
    and (b.banned_until is null or b.banned_until > now())
  order by b.created_at desc
  limit 1;
  if not found then
    return jsonb_build_object('banned', false, 'admin', false);
  end if;
  return jsonb_build_object(
    'banned', true,
    'admin', false,
    'until', v_until,
    'indefinite', v_until is null,
    'reason', v_reason
  );
end;
$function$;

revoke all on function public.admin_ban_status(uuid) from public, anon;
grant execute on function public.admin_ban_status(uuid) to authenticated, service_role;

create or replace function public.admin_ban_user(p_user_id uuid, p_length text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := private.assert_staff();
  v_length text := lower(btrim(coalesce(p_length, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_until timestamptz;
  v_id uuid;
  v_admin boolean;
begin
  if p_user_id is null then
    raise exception 'That user was not found.' using errcode = 'P0002';
  end if;
  select p.is_admin into v_admin
  from public.profiles p
  where p.id = p_user_id;
  if v_admin is null then
    raise exception 'That user was not found.' using errcode = 'P0002';
  end if;
  if v_admin or p_user_id = v_actor then
    raise exception 'The admin account cannot be banned.' using errcode = 'P0001';
  end if;
  if v_length = '1 day' then
    v_until := now() + interval '1 day';
  elsif v_length = '3 days' then
    v_until := now() + interval '3 days';
  elsif v_length = '7 days' then
    v_until := now() + interval '7 days';
  elsif v_length = '1 month' then
    v_until := now() + interval '1 month';
  elsif v_length = 'indefinite' then
    v_until := null;
  else
    raise exception 'Pick 1 day, 3 days, 7 days, 1 month, or indefinitely.' using errcode = 'P0001';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.' using errcode = 'P0001';
  end if;
  update public.user_bans
    set lifted_at = now(),
        lifted_by = v_actor
    where user_id = p_user_id
      and lifted_at is null
      and (banned_until is null or banned_until > now());
  insert into public.user_bans (user_id, banned_until, reason, banned_by)
  values (p_user_id, v_until, v_reason, v_actor)
  returning id into v_id;
  perform private.admin_audit(v_actor, 'ban_user', 'user_bans', v_id, coalesce(v_reason, v_length));
  return jsonb_build_object(
    'id', v_id,
    'user_id', p_user_id,
    'until', v_until,
    'indefinite', v_until is null
  );
end;
$function$;

revoke all on function public.admin_ban_user(uuid, text, text) from public, anon;
grant execute on function public.admin_ban_user(uuid, text, text) to authenticated, service_role;

create or replace function public.admin_unban_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := private.assert_staff();
  v_id uuid;
  v_until timestamptz;
begin
  if exists (select 1 from public.profiles p where p.id = p_user_id and p.is_admin) then
    raise exception 'The admin account cannot be banned.' using errcode = 'P0001';
  end if;
  with closed as (
    update public.user_bans
      set lifted_at = now(),
          lifted_by = v_actor
      where user_id = p_user_id
        and lifted_at is null
        and (banned_until is null or banned_until > now())
      returning id, banned_until
  )
  select id, banned_until into v_id, v_until from closed limit 1;
  if v_id is null then
    raise exception 'That user is not banned.' using errcode = 'P0001';
  end if;
  perform private.admin_audit(v_actor, 'unban_user', 'user_bans', v_id, null);
  return jsonb_build_object(
    'id', v_id,
    'user_id', p_user_id,
    'until', v_until,
    'indefinite', v_until is null
  );
end;
$function$;

revoke all on function public.admin_unban_user(uuid) from public, anon;
grant execute on function public.admin_unban_user(uuid) to authenticated, service_role;

create or replace function private.block_banned_write()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_until timestamptz;
begin
  if not public.is_banned() then
    return new;
  end if;
  select b.banned_until into v_until
  from public.user_bans b
  where b.user_id = auth.uid()
    and b.lifted_at is null
    and (b.banned_until is null or b.banned_until > now())
  order by b.created_at desc
  limit 1;
  if v_until is null then
    raise exception 'Your account is banned indefinitely. You can still browse.' using errcode = '42501';
  end if;
  raise exception 'Your account is banned until %. You can still browse.',
    to_char(v_until at time zone 'Australia/Sydney', 'FMDD Mon YYYY, HH12:MI am')
    using errcode = '42501';
end;
$function$;

revoke all on function private.block_banned_write() from public;

drop trigger if exists block_banned_write on public.forum_threads;
create trigger block_banned_write
  before insert or update on public.forum_threads
  for each row execute function private.block_banned_write();

drop trigger if exists block_banned_write on public.forum_replies;
create trigger block_banned_write
  before insert or update on public.forum_replies
  for each row execute function private.block_banned_write();

drop trigger if exists block_banned_write on public.listings;
create trigger block_banned_write
  before insert or update on public.listings
  for each row execute function private.block_banned_write();

drop trigger if exists block_banned_write on public.listing_contacts;
create trigger block_banned_write
  before insert or update on public.listing_contacts
  for each row execute function private.block_banned_write();

drop trigger if exists block_banned_write on public.messages;
create trigger block_banned_write
  before insert on public.messages
  for each row execute function private.block_banned_write();

drop trigger if exists block_banned_write on public.conversations;
create trigger block_banned_write
  before insert on public.conversations
  for each row execute function private.block_banned_write();

drop trigger if exists block_banned_write on public.likes;
create trigger block_banned_write
  before insert on public.likes
  for each row execute function private.block_banned_write();

drop policy if exists "post threads with handle" on public.forum_threads;
create policy "post threads with handle"
  on public.forum_threads
  for insert
  to authenticated
  with check ((author_id = auth.uid()) and has_handle() and not public.is_banned());

drop policy if exists "edit own threads" on public.forum_threads;
create policy "edit own threads"
  on public.forum_threads
  for update
  to authenticated
  using ((author_id = auth.uid()) and not public.is_banned())
  with check ((author_id = auth.uid()) and not public.is_banned());

drop policy if exists "post replies with handle" on public.forum_replies;
create policy "post replies with handle"
  on public.forum_replies
  for insert
  to authenticated
  with check ((author_id = auth.uid()) and has_handle() and not public.is_banned());

drop policy if exists "edit own replies" on public.forum_replies;
create policy "edit own replies"
  on public.forum_replies
  for update
  to authenticated
  using ((author_id = auth.uid()) and not public.is_banned())
  with check ((author_id = auth.uid()) and not public.is_banned());

drop policy if exists listings_insert on public.listings;
create policy listings_insert
  on public.listings
  for insert
  to authenticated
  with check (((select auth.uid()) = user_id) and not public.is_banned());

drop policy if exists listings_update on public.listings;
create policy listings_update
  on public.listings
  for update
  to authenticated
  using (((select auth.uid()) = user_id) and not public.is_banned())
  with check (((select auth.uid()) = user_id) and not public.is_banned());

drop policy if exists lc_insert_own on public.listing_contacts;
create policy lc_insert_own
  on public.listing_contacts
  for insert
  to authenticated
  with check (
    (user_id = auth.uid())
    and not public.is_banned()
    and exists (
      select 1 from public.listings l
      where l.id = listing_contacts.listing_id
        and l.user_id = auth.uid()
    )
  );

drop policy if exists lc_update_own on public.listing_contacts;
create policy lc_update_own
  on public.listing_contacts
  for update
  to authenticated
  using ((user_id = auth.uid()) and not public.is_banned())
  with check ((user_id = auth.uid()) and not public.is_banned());

drop policy if exists "buyer starts convo" on public.conversations;
create policy "buyer starts convo"
  on public.conversations
  for insert
  to authenticated
  with check (
    (buyer_id = auth.uid())
    and has_handle()
    and not public.is_banned()
    and exists (
      select 1 from public.listings l
      where l.id = conversations.listing_id
        and l.user_id = conversations.seller_id
    )
  );

drop policy if exists "participants send msgs" on public.messages;
create policy "participants send msgs"
  on public.messages
  for insert
  to authenticated
  with check (
    (sender_id = auth.uid())
    and is_participant(conversation_id)
    and not public.is_banned()
  );

drop policy if exists likes_insert on public.likes;
create policy likes_insert
  on public.likes
  for insert
  to authenticated
  with check (((select auth.uid()) = user_id) and not public.is_banned());
