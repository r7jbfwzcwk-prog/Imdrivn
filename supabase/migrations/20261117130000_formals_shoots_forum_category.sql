-- Real forum board. Idempotent. Does not change RLS.
insert into public.forum_categories (slug, name, description, sort)
select 'formals-shoots-weddings', 'Formals, Shoots, Weddings and Special Events', 'Share your ride for hire here', coalesce((select max(sort) from public.forum_categories), 0) + 1
where not exists (
  select 1 from public.forum_categories
  where slug = 'formals-shoots-weddings' or name = 'Formals, Shoots, Weddings and Special Events'
);
