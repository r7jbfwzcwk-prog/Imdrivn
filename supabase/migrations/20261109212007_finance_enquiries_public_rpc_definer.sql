-- REPO RECORD of live applied migration version 20261109212007. Do not reapply.
-- SUPERSEDED by 20261109214548_finance_enquiries_security_invoker_gateway.sql.
-- This temporary public SECURITY DEFINER wrapper must not be reapplied after that gateway.
-- Original upload: 20261110072000_finance_enquiries_public_rpc_definer_186d.sql
-- Guest (anon) cannot USE private schema, so public RPC must be SECURITY DEFINER
-- to call private.submit_finance_enquiry. search_path locked empty.

create or replace function public.submit_finance_enquiry(
  p_full_name text,
  p_employment_status text,
  p_state text,
  p_mobile text,
  p_email text,
  p_listing_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  return private.submit_finance_enquiry(
    p_full_name,
    p_employment_status,
    p_state,
    p_mobile,
    p_email,
    p_listing_id
  );
end;
$function$;

revoke all on function public.submit_finance_enquiry(text, text, text, text, text, uuid) from public;
grant execute on function public.submit_finance_enquiry(text, text, text, text, text, uuid)
  to anon, authenticated, service_role;

comment on function public.submit_finance_enquiry(text, text, text, text, text, uuid) is
  'Submit IM DRIVN finance quiz (5 fields + optional listing_id). Sets user_id from auth.uid() only. SECURITY DEFINER wrapper so anon guests can submit without private schema USAGE.';
