-- Add the 4x4 Off-road lane. Existing listings stay on their current mode.

alter table public.listings drop constraint if exists listings_mode_check;

alter table public.listings
  add constraint listings_mode_check
  check (mode = any (array['daily'::text, '4x4'::text, 'performance'::text, 'supercar'::text]));
