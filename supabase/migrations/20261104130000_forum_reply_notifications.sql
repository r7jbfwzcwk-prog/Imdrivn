-- Notify the thread author and earlier repliers when a forum reply is posted.
-- The replier is never notified about their own reply.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  reply_id uuid not null references public.forum_replies(id) on delete cascade,
  thread_title text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, reply_id)
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_read_own
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

create policy notifications_mark_own
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.notify_forum_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_author uuid;
begin
  select title, author_id into v_title, v_author
  from public.forum_threads
  where id = new.thread_id;

  if v_author is null then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, thread_id, reply_id, thread_title)
  select people.uid, new.author_id, new.thread_id, new.id, left(coalesce(v_title, ''), 140)
  from (
    select v_author as uid
    union
    select r.author_id
    from public.forum_replies r
    where r.thread_id = new.thread_id
      and r.id <> new.id
  ) people
  where people.uid is not null
    and people.uid <> new.author_id
  on conflict (user_id, reply_id) do nothing;

  return new;
end;
$$;

revoke all on function public.notify_forum_reply() from public, anon, authenticated;

drop trigger if exists forum_replies_notify on public.forum_replies;
create trigger forum_replies_notify
  after insert on public.forum_replies
  for each row
  execute function public.notify_forum_reply();

alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
