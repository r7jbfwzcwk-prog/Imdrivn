-- edited_at is set only when an author changes the text or the photo.
-- Creating a post leaves it null. Moderation updates do not touch it.

alter table public.forum_threads
  add column if not exists edited_at timestamptz;

alter table public.forum_replies
  add column if not exists edited_at timestamptz;

comment on column public.forum_threads.edited_at is
  'Set when the author changes the title, body, or photo. Null until the first edit.';
comment on column public.forum_replies.edited_at is
  'Set when the author changes the body or photo. Null until the first edit.';

create or replace function private.forum_mark_edited()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_changed boolean;
begin
  v_changed := new.body is distinct from old.body
    or new.photo_path is distinct from old.photo_path;
  if tg_table_name = 'forum_threads' and new.title is distinct from old.title then
    v_changed := true;
  end if;
  if v_changed then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists forum_threads_mark_edited on public.forum_threads;
create trigger forum_threads_mark_edited
  before update on public.forum_threads
  for each row execute function private.forum_mark_edited();

drop trigger if exists forum_replies_mark_edited on public.forum_replies;
create trigger forum_replies_mark_edited
  before update on public.forum_replies
  for each row execute function private.forum_mark_edited();
