-- One in-app reminder for an active ad that still has no photos, then again
-- every 24 hours. The first run sends at most one alert per ad, not one for
-- every day it has already been up. Reminders stop once photos are added or
-- the ad is sold or removed.

alter table public.listings
  add column if not exists last_photo_reminder_at timestamptz;

alter table public.notifications
  add column if not exists listing_id uuid references public.listings(id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind = any (array['reply'::text, 'mention'::text, 'message'::text, 'moderation'::text, 'photo'::text]));

create index if not exists notifications_photo_listing_idx
  on public.notifications (listing_id, created_at desc)
  where kind = 'photo';

create unique index if not exists notifications_photo_unread_uidx
  on public.notifications (listing_id)
  where kind = 'photo' and read_at is null and listing_id is not null;

create index if not exists listings_missing_photo_idx
  on public.listings (created_at)
  where status = 'active' and removed_at is null and cardinality(photos) = 0;

create or replace function public.keep_photo_reminder_stamp()
returns trigger
language plpgsql
as $$
begin
  if current_setting('imdrivn.photo_reminder', true) is distinct from '1' then
    new.last_photo_reminder_at := old.last_photo_reminder_at;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_keep_photo_reminder on public.listings;
create trigger listings_keep_photo_reminder
  before update on public.listings
  for each row
  execute function public.keep_photo_reminder_stamp();

create or replace function public.clear_photo_reminders()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  if coalesce(cardinality(new.photos), 0) > 0
     or new.status is distinct from 'active'
     or new.removed_at is not null then
    update public.notifications
      set read_at = now()
      where listing_id = new.id
        and kind = 'photo'
        and read_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.clear_photo_reminders() from public, anon, authenticated;

drop trigger if exists listings_clear_photo_reminders on public.listings;
create trigger listings_clear_photo_reminders
  after update on public.listings
  for each row
  execute function public.clear_photo_reminders();

create or replace function public.remind_missing_photos()
returns integer
language plpgsql
security definer
set search_path to public
as $$
declare
  r record;
  v_name text;
  v_title text;
  v_body text := 'Ads with photos sell a lot quicker. Photos are important, so add some now.';
  n int := 0;
begin
  perform set_config('imdrivn.photo_reminder', '1', true);
  for r in
    select l.id, l.user_id, l.year, l.make, l.model, l.heading
    from public.listings l
    where l.status = 'active'
      and l.removed_at is null
      and coalesce(cardinality(l.photos), 0) = 0
      and l.created_at <= now() - interval '24 hours'
      and (l.last_photo_reminder_at is null or l.last_photo_reminder_at <= now() - interval '24 hours')
    for update of l skip locked
  loop
    update public.notifications
      set read_at = now()
      where listing_id = r.id
        and kind = 'photo'
        and read_at is null;

    v_name := nullif(btrim(concat_ws(' ', r.year::text, nullif(btrim(r.make), ''), nullif(btrim(r.model), ''))), '');
    v_title := left('Add photos to your ' || coalesce(v_name, nullif(btrim(r.heading), ''), 'ad'), 140);

    insert into public.notifications (user_id, actor_id, kind, thread_title, preview, listing_id)
    values (r.user_id, r.user_id, 'photo', v_title, v_body, r.id);

    update public.listings
      set last_photo_reminder_at = now()
      where id = r.id;

    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.remind_missing_photos() from public, anon, authenticated;

do $$
declare
  v_job bigint;
begin
  select jobid into v_job from cron.job where jobname = 'remind-missing-photos';
  if v_job is not null then
    perform cron.unschedule(v_job);
  end if;
  perform cron.schedule(
    'remind-missing-photos',
    '17 * * * *',
    $cron$select public.remind_missing_photos();$cron$
  );
end;
$$;
