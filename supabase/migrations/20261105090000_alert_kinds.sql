-- Alerts cover direct messages, forum replies, and @mentions.
-- Opening the list does not mark anything read. Each row is marked when that alert is opened.

alter table public.notifications
  add column if not exists kind text not null default 'reply',
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
  add column if not exists message_id uuid references public.messages(id) on delete cascade,
  add column if not exists preview text;

alter table public.notifications alter column thread_id drop not null;
alter table public.notifications alter column reply_id drop not null;
alter table public.notifications alter column thread_title set default '';

alter table public.notifications drop constraint if exists notifications_user_id_reply_id_key;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('reply', 'mention', 'message'));

create unique index if not exists notifications_user_reply_kind_uidx
  on public.notifications (user_id, reply_id, kind)
  where reply_id is not null;

create unique index if not exists notifications_user_message_uidx
  on public.notifications (user_id, message_id)
  where message_id is not null;

update public.notifications n
set preview = left(r.body, 140)
from public.forum_replies r
where n.reply_id = r.id
  and (n.preview is null or n.preview = '');

insert into public.notifications (user_id, actor_id, kind, conversation_id, message_id, preview, thread_title)
select
  case when m.sender_id = c.buyer_id then c.seller_id else c.buyer_id end,
  m.sender_id,
  'message',
  c.id,
  m.id,
  left(m.body, 140),
  ''
from public.messages m
join public.conversations c on c.id = m.conversation_id
where m.read_at is null
  and m.sender_id is distinct from case when m.sender_id = c.buyer_id then c.seller_id else c.buyer_id end
on conflict (user_id, message_id) where message_id is not null do nothing;

create or replace function public.notify_forum_reply()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_title text;
  v_author uuid;
  v_preview text;
begin
  select title, author_id into v_title, v_author
  from public.forum_threads
  where id = new.thread_id;

  if v_author is null then
    return new;
  end if;

  v_preview := left(coalesce(new.body, ''), 140);

  insert into public.notifications (user_id, actor_id, thread_id, reply_id, thread_title, kind, preview)
  select people.uid, new.author_id, new.thread_id, new.id, left(coalesce(v_title, ''), 140), 'reply', v_preview
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
  on conflict (user_id, reply_id, kind) where reply_id is not null do nothing;

  insert into public.notifications (user_id, actor_id, thread_id, reply_id, thread_title, kind, preview)
  select distinct p.id, new.author_id, new.thread_id, new.id, left(coalesce(v_title, ''), 140), 'mention', v_preview
  from regexp_matches(coalesce(new.body, ''), '(?:^|[^A-Za-z0-9._])@([A-Za-z0-9._]{3,20})', 'g') as hit(m)
  join public.profiles p on lower(p.username) = lower(hit.m[1])
  where p.id <> new.author_id
  on conflict (user_id, reply_id, kind) where reply_id is not null do nothing;

  return new;
end;
$$;

create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_recipient uuid;
begin
  select case when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end
    into v_recipient
  from public.conversations c
  where c.id = new.conversation_id;

  if v_recipient is null or v_recipient = new.sender_id then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, kind, conversation_id, message_id, preview, thread_title)
  values (v_recipient, new.sender_id, 'message', new.conversation_id, new.id, left(coalesce(new.body, ''), 140), '')
  on conflict (user_id, message_id) where message_id is not null do nothing;

  return new;
end;
$$;

revoke all on function public.notify_direct_message() from public, anon, authenticated;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
  after insert on public.messages
  for each row
  execute function public.notify_direct_message();
