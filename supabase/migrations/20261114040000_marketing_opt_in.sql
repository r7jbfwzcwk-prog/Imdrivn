-- Member marketing consent. New and existing profiles start opted in.
-- A member can turn it off from My Garage > Edit my details.

alter table public.profiles
  add column if not exists marketing_opt_in boolean not null default true,
  add column if not exists marketing_opt_out_at timestamptz;

comment on column public.profiles.marketing_opt_in is
  'True when the member agrees to news and deals by email and SMS.';
comment on column public.profiles.marketing_opt_out_at is
  'When the member last unsubscribed. Null while they are opted in.';
