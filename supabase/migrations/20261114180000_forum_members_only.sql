-- Forum threads, replies, and photos are visible only to signed-in members.
-- Admins keep their existing read of removed posts. Service role bypasses RLS.

drop policy if exists "read threads" on public.forum_threads;
create policy "read threads"
  on public.forum_threads
  for select
  to authenticated
  using (removed_at is null);

drop policy if exists "read replies" on public.forum_replies;
create policy "read replies"
  on public.forum_replies
  for select
  to authenticated
  using (
    removed_at is null
    and exists (
      select 1 from public.forum_threads t
      where t.id = forum_replies.thread_id
        and t.removed_at is null
    )
  );

update storage.buckets
set public = false
where id = 'forum-photos';

drop policy if exists forum_photos_public_read on storage.objects;
drop policy if exists forum_photos_read on storage.objects;
create policy forum_photos_read
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'forum-photos');
