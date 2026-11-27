-- REPO / PACKAGE RECORD only until Joe's push (27 Nov 2026).
-- Do NOT apply to production on its own. Goes live with the site package.
-- Private bucket for official PPSR search certificate PDFs so the customer
-- (and admins) can view and download them on the IM DRIVN report page.
-- The Edge Function ppsr-vin-search uploads to {order_id}/{filename}.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vin-certificates',
  'vin-certificates',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vin_certificates_select_own on storage.objects;
create policy vin_certificates_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'vin-certificates'
    and (
      public.is_admin()
      or exists (
        select 1 from public.vin_check_orders o
        where o.id::text = split_part(name, '/', 1)
          and o.user_id = auth.uid()
      )
    )
  );

drop policy if exists vin_check_orders_select_admin on public.vin_check_orders;
create policy vin_check_orders_select_admin
  on public.vin_check_orders
  for select
  to authenticated
  using (public.is_admin());
