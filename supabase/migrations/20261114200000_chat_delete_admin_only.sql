-- Only an admin can delete a live chat message. The author cannot.

drop policy if exists chat_messages_delete on public.chat_messages;
create policy chat_messages_delete
  on public.chat_messages
  for delete
  to authenticated
  using (public.is_admin());

create or replace function public.chat_messages_delete_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is not null and not coalesce(public.is_admin(), false) then
    raise exception 'Only an admin can delete a chat message.' using errcode = '42501';
  end if;
  return old;
end;
$function$;

revoke all on function public.chat_messages_delete_guard() from public, anon, authenticated;

drop trigger if exists chat_messages_delete_guard on public.chat_messages;
create trigger chat_messages_delete_guard
  before delete on public.chat_messages
  for each row execute function public.chat_messages_delete_guard();
