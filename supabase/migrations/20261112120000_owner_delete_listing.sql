-- Owners can soft-delete their own ads. Same removed status the admin
-- removal uses, so the ad leaves feeds and search immediately. Admin
-- removal of someone else's ad is unchanged.

create or replace function public.delete_own_listing(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.listings%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in to delete an ad.' using errcode = '42501';
  end if;
  select * into v_row from public.listings where id = p_id;
  if v_row.id is null or v_row.user_id is distinct from v_uid then
    raise exception 'You can only delete your own ad.' using errcode = '42501';
  end if;
  if v_row.status = 'removed' then
    raise exception 'That ad is already deleted.' using errcode = 'P0001';
  end if;
  update public.listings
    set status = 'removed',
        status_before_removal = v_row.status,
        removed_at = now(),
        removed_by = v_uid,
        removal_reason = 'Deleted by owner.'
    where id = v_row.id
      and user_id = v_uid;
  return jsonb_build_object('id', v_row.id, 'status', 'removed');
end;
$function$;

revoke all on function public.delete_own_listing(uuid) from public, anon;
grant execute on function public.delete_own_listing(uuid) to authenticated, service_role;
