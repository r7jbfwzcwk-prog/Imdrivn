-- Recipient read time for a direct message. Null means the recipient has not opened it.
-- Own messages never count as unread. Read time is set only when that person opens the conversation.

alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists messages_unread_idx
  on public.messages (conversation_id)
  where read_at is null;

update public.messages m
set read_at = case
  when m.sender_id = c.buyer_id then c.seller_last_read
  else c.buyer_last_read
end
from public.conversations c
where c.id = m.conversation_id
  and m.read_at is null
  and (
    (m.sender_id = c.buyer_id and c.seller_last_read is not null and c.seller_last_read >= m.created_at)
    or
    (m.sender_id = c.seller_id and c.buyer_last_read is not null and c.buyer_last_read >= m.created_at)
  );

grant update (read_at) on public.messages to authenticated;

drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read
  on public.messages
  for update
  to authenticated
  using (is_participant(conversation_id) and sender_id is distinct from auth.uid())
  with check (is_participant(conversation_id) and sender_id is distinct from auth.uid());

create or replace function public.protect_message_read()
returns trigger
language plpgsql
set search_path to public
as $$
begin
  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'Only read state can change';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Already read';
  end if;
  if auth.uid() is not null and new.sender_id = auth.uid() then
    raise exception 'Only the recipient can mark a message read';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_protect_read on public.messages;
create trigger messages_protect_read
  before update on public.messages
  for each row execute function public.protect_message_read();

create or replace function public.msg_bump()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  update public.conversations
  set last_message_at = now(),
      last_message = left(new.body, 140)
  where id = new.conversation_id;
  return new;
end;
$$;
