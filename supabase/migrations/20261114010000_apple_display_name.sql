-- Apple sends a real name only on the first sign-in, sometimes as a name object,
-- and often hides the email behind privaterelay.appleid.com. Store a real name
-- when one arrives, and leave display_name empty when it does not.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name_text text := nullif(btrim(coalesce(meta->>'full_name', '')), '');
  name_obj jsonb;
  first_name text;
  last_name text;
  email_local text := split_part(coalesce(new.email, ''), '@', 1);
  email_domain text := split_part(coalesce(new.email, ''), '@', 2);
begin
  if name_text is null or name_text = 'null' or left(name_text, 1) in ('{', '[') then
    name_text := null;
  end if;
  if name_text is null and jsonb_typeof(meta->'name') = 'string' then
    name_text := nullif(btrim(meta->>'name'), '');
    if name_text is not null and (name_text = 'null' or left(name_text, 1) in ('{', '[')) then
      name_text := null;
    end if;
  elsif name_text is null and jsonb_typeof(meta->'name') = 'object' then
    name_obj := meta->'name';
    first_name := nullif(btrim(coalesce(name_obj->>'firstName', name_obj->>'first_name', name_obj->>'given_name', '')), '');
    last_name := nullif(btrim(coalesce(name_obj->>'lastName', name_obj->>'last_name', name_obj->>'family_name', '')), '');
    name_text := nullif(btrim(concat_ws(' ', first_name, last_name)), '');
  end if;
  if name_text is null then
    first_name := nullif(btrim(coalesce(meta->>'given_name', meta->>'first_name', '')), '');
    last_name := nullif(btrim(coalesce(meta->>'family_name', meta->>'last_name', '')), '');
    name_text := nullif(btrim(concat_ws(' ', first_name, last_name)), '');
  end if;
  if name_text is null and email_local <> '' and email_domain !~* 'privaterelay\.appleid\.com' then
    name_text := email_local;
  end if;
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, name_text, nullif(meta->>'avatar_url', ''));
  return new;
end;
$$;
