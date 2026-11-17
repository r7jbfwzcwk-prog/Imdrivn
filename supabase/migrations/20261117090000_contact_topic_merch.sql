-- Allow Merch on the About contact form, between Partnerships and Other.

alter table public.contact_messages drop constraint if exists contact_messages_topic;
alter table public.contact_messages add constraint contact_messages_topic
  check (topic in ('General', 'Sellin', 'Buyin', 'Report a listing', 'Partnerships', 'Merch', 'Other'));

drop policy if exists contact_messages_insert on public.contact_messages;
create policy contact_messages_insert
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(name)) between 2 and 80
    and email ~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    and topic in ('General', 'Sellin', 'Buyin', 'Report a listing', 'Partnerships', 'Merch', 'Other')
    and char_length(btrim(message)) between 8 and 2000
    and (user_id is null or user_id = (select auth.uid()))
  );

do $$
declare
  src text;
begin
  src := pg_get_functiondef('private.contact_message_guard()'::regprocedure);
  src := replace(
    src,
    'topic not in (''General'', ''Sellin'', ''Buyin'', ''Report a listing'', ''Partnerships'', ''Other'')',
    'topic not in (''General'', ''Sellin'', ''Buyin'', ''Report a listing'', ''Partnerships'', ''Merch'', ''Other'')'
  );
  execute src;
end $$;
