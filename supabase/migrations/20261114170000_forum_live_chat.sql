-- One global forum live-chat room. Authenticated members can read and
-- post as themselves. Admins can delete. Banned accounts cannot post.
-- Realtime delivers new rows and deletions to the open room.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  handle text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_body_len check (char_length(body) between 1 and 500),
  constraint chat_messages_handle_len check (char_length(handle) between 1 and 40)
);

create index if not exists chat_messages_created_idx
  on public.chat_messages (created_at desc);

create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;

revoke all on table public.chat_messages from public, anon;
grant select, insert, delete on table public.chat_messages to authenticated;
grant all on table public.chat_messages to service_role;

drop policy if exists chat_messages_read on public.chat_messages;
create policy chat_messages_read
  on public.chat_messages
  for select
  to authenticated
  using (true);

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert
  on public.chat_messages
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_handle()
    and not public.is_banned()
  );

drop policy if exists chat_messages_delete on public.chat_messages;
create policy chat_messages_delete
  on public.chat_messages
  for delete
  to authenticated
  using (public.is_admin());

create or replace function public.chat_messages_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_handle text;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'You need to be signed in to do that.' using errcode = '42501';
  end if;
  if public.is_banned() then
    raise exception 'Your account is banned. You can still browse.' using errcode = '42501';
  end if;
  if not public.has_handle() then
    raise exception 'Choose a handle first.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('imdrivn-live'), hashtext(auth.uid()::text));
  select p.username into v_handle
  from public.profiles p
  where p.id = auth.uid();
  new.handle := left(btrim(coalesce(v_handle, '')), 40);
  new.user_id := auth.uid();
  new.created_at := now();
  new.body := regexp_replace(coalesce(new.body, ''), '<[^>]*>', '', 'g');
  new.body := replace(replace(new.body, '<', ''), '>', '');
  new.body := regexp_replace(new.body, '[[:space:]]+', ' ', 'g');
  new.body := btrim(new.body);
  if char_length(new.body) < 1 then
    raise exception 'Write a message first.' using errcode = '22023';
  end if;
  if char_length(new.body) > 500 then
    raise exception 'Keep it to 500 characters.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.chat_messages m
    where m.user_id = auth.uid()
      and m.created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Slow down. One message every 2 seconds.' using errcode = '42501';
  end if;
  return new;
end;
$function$;

revoke all on function public.chat_messages_guard() from public, anon, authenticated;

drop trigger if exists chat_messages_guard on public.chat_messages;
create trigger chat_messages_guard
  before insert on public.chat_messages
  for each row execute function public.chat_messages_guard();

drop trigger if exists block_banned_write on public.chat_messages;
create trigger block_banned_write
  before insert on public.chat_messages
  for each row execute function private.block_banned_write();

alter table public.chat_messages replica identity full;

do $pub$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$pub$;
