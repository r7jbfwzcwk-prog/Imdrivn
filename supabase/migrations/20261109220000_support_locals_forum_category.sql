-- Real forum board. Idempotent. Does not change RLS.
insert into public.forum_categories (slug, name, description, sort)
select 'support-locals', 'Support locals', 'Post up your business', coalesce((select max(sort) from public.forum_categories), 0) + 1
where not exists (
  select 1 from public.forum_categories
  where slug = 'support-locals' or name = 'Support locals'
);
