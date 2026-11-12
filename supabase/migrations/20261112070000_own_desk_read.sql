-- Let a signed-in person read their own ad reports and Contact us messages.
-- Admin read policies stay as they are. Existing rows are not changed.

drop policy if exists ad_reports_own_read on public.ad_reports;
create policy ad_reports_own_read
  on public.ad_reports
  for select
  to authenticated
  using (reporter_id = auth.uid());

drop policy if exists contact_messages_own_read on public.contact_messages;
create policy contact_messages_own_read
  on public.contact_messages
  for select
  to authenticated
  using (user_id = auth.uid());
