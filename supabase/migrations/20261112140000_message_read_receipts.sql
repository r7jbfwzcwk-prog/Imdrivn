-- Read receipts. A message is read only when its recipient opens the thread.
-- Participants can see read_at. Only the recipient can set it, and only that column.
-- Each person can update only their own conversation read time.

revoke update on table public.messages from anon, authenticated;
grant update (read_at) on table public.messages to authenticated;

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

revoke update on table public.conversations from anon, authenticated;
grant update (buyer_last_read, seller_last_read) on table public.conversations to authenticated;

create or replace function public.protect_conversation_read()
returns trigger
language plpgsql
set search_path to public
as $$
begin
  if new.buyer_last_read is distinct from old.buyer_last_read
     and auth.uid() is distinct from new.buyer_id then
    raise exception 'Only the buyer can set their read time';
  end if;
  if new.seller_last_read is distinct from old.seller_last_read
     and auth.uid() is distinct from new.seller_id then
    raise exception 'Only the seller can set their read time';
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_protect_read on public.conversations;
create trigger conversations_protect_read
  before update on public.conversations
  for each row execute function public.protect_conversation_read();
