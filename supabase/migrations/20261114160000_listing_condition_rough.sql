-- New condition choices are Rough and Needs work. Absolute shed stays
-- allowed so ads already saved with that value still read and update.

alter table public.listings drop constraint if exists listings_condition_check;

alter table public.listings add constraint listings_condition_check
  check (
    condition is null
    or condition = any (array[
      'It''s mint',
      'Pretty good',
      'Not bad',
      'Average',
      'Rough',
      'Needs work',
      'Absolute shed'
    ]::text[])
  );
