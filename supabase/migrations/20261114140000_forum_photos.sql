-- One optional photo on a forum thread and one on a reply.
-- The file lives in the public forum-photos bucket, under the author's folder.

alter table public.forum_threads
  add column if not exists photo_path text;

alter table public.forum_replies
  add column if not exists photo_path text;

comment on column public.forum_threads.photo_path is
  'One optional photo in the forum-photos bucket, stored as <author-id>/<file>.';
comment on column public.forum_replies.photo_path is
  'One optional photo in the forum-photos bucket, stored as <author-id>/<file>.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'forum-photos',
  'forum-photos',
  true,
  1048576,
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.forum_photo_path_ok()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.photo_path is null or btrim(new.photo_path) = '' then
    new.photo_path := null;
    return new;
  end if;
  if new.photo_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpe?g|png)$' then
    raise exception 'That photo path is not allowed.' using errcode = '22023';
  end if;
  if split_part(new.photo_path, '/', 1) is distinct from new.author_id::text then
    raise exception 'That photo path is not allowed.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists forum_threads_photo_path on public.forum_threads;
create trigger forum_threads_photo_path
  before insert or update on public.forum_threads
  for each row execute function private.forum_photo_path_ok();

drop trigger if exists forum_replies_photo_path on public.forum_replies;
create trigger forum_replies_photo_path
  before insert or update on public.forum_replies
  for each row execute function private.forum_photo_path_ok();

create or replace function private.delete_forum_photo()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if old.photo_path is not null and btrim(old.photo_path) <> '' then
    delete from storage.objects
    where bucket_id = 'forum-photos'
      and name = old.photo_path;
  end if;
  return old;
end;
$$;

drop trigger if exists forum_threads_delete_photo on public.forum_threads;
create trigger forum_threads_delete_photo
  before delete on public.forum_threads
  for each row execute function private.delete_forum_photo();

drop trigger if exists forum_replies_delete_photo on public.forum_replies;
create trigger forum_replies_delete_photo
  before delete on public.forum_replies
  for each row execute function private.delete_forum_photo();

drop policy if exists forum_photos_public_read on storage.objects;
create policy forum_photos_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'forum-photos');

drop policy if exists forum_photos_insert on storage.objects;
create policy forum_photos_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'forum-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists forum_photos_delete on storage.objects;
create policy forum_photos_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'forum-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
