-- PPSR VIN check outage mode. Do not apply until Joe says to go live.
-- Adds a site_settings flag (ppsr_status) the site can read, an outage
-- order status for paid searches that must be retried or refunded, and a
-- 5-minute cron that applies the published weekly maintenance window.
-- The live health check (non-billable B2G Ping via the relay) lives in
-- Edge Function ppsr-status with body { "check": true } (service role).

insert into public.site_settings (key, value)
values (
  'ppsr_status',
  jsonb_build_object(
    'state', 'ok',
    'reason', null,
    'message', '',
    'source', 'ok',
    'checked_at', now(),
    'window_end', null,
    'health', null
  )
)
on conflict (key) do nothing;

alter table public.vin_check_orders
  add column if not exists outage_retries integer not null default 0;

alter table public.vin_check_orders drop constraint if exists vin_check_orders_status_check;
alter table public.vin_check_orders
  add constraint vin_check_orders_status_check
  check (status = any (array[
    'pending_payment'::text,
    'paid'::text,
    'searching'::text,
    'complete'::text,
    'failed'::text,
    'expired'::text,
    'outage'::text
  ]));

create or replace function private.ppsr_weekly_window(p_now timestamptz default now())
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_local timestamp;
  v_dow integer;
  v_md text;
  v_holiday boolean;
  v_in boolean;
begin
  -- Canberra time is Australia/Sydney (AEDT/AEST).
  -- Registrar's Notice 14: every Wednesday 9:00pm to 11:59pm Canberra time,
  -- except Wednesdays on or between 21 December and 1 January.
  -- We start the flag 5 minutes early (8:55pm) so payment cannot slip in.
  v_local := timezone('Australia/Sydney', p_now);
  v_dow := extract(dow from v_local)::integer; -- 0 Sunday, 3 Wednesday
  v_md := to_char(v_local, 'MM-DD');
  v_holiday := (v_md >= '12-21' and v_md <= '12-31') or v_md = '01-01';
  v_in := (v_dow = 3) and (not v_holiday) and (v_local::time >= time '20:55:00');
  if v_in then
    return jsonb_build_object(
      'state', 'down',
      'reason', 'weekly_maintenance',
      'message', 'PPSR is down for weekly maintenance',
      'source', 'schedule',
      'checked_at', p_now,
      'window_end', (date_trunc('day', v_local) + interval '1 day') at time zone 'Australia/Sydney'
    );
  end if;
  return jsonb_build_object(
    'state', 'ok',
    'reason', null,
    'message', '',
    'source', 'ok',
    'checked_at', p_now,
    'window_end', null
  );
end;
$function$;

revoke all on function private.ppsr_weekly_window(timestamptz) from public, anon, authenticated;

create or replace function private.apply_ppsr_schedule()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_now timestamptz := now();
  v_window jsonb := private.ppsr_weekly_window(v_now);
  v_current jsonb;
  v_next jsonb;
  v_source text;
  v_state text;
begin
  select s.value into v_current from public.site_settings s where s.key = 'ppsr_status';
  v_source := coalesce(v_current->>'source', 'ok');
  v_state := coalesce(v_current->>'state', 'ok');

  -- A manual down flag stays down until it is cleared in the database.
  if v_source = 'manual' and v_state = 'down' then
    v_next := v_current || jsonb_build_object('checked_at', v_now);
    update public.site_settings
      set value = v_next, updated_at = v_now
      where key = 'ppsr_status';
    return v_next;
  end if;

  if v_window->>'state' = 'down' then
    v_next := v_window || jsonb_build_object('health', v_current->'health');
    insert into public.site_settings (key, value, updated_at)
    values ('ppsr_status', v_next, v_now)
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
    return v_next;
  end if;

  -- Do not clear a health-detected outage from the schedule job. The Ping
  -- check in Edge Function ppsr-status does that.
  if v_source = 'health' and v_state = 'down' then
    v_next := v_current || jsonb_build_object('checked_at', v_now);
    update public.site_settings
      set value = v_next, updated_at = v_now
      where key = 'ppsr_status';
    return v_next;
  end if;

  if v_source = 'schedule' and v_state = 'down' then
    v_next := jsonb_build_object(
      'state', 'ok',
      'reason', null,
      'message', '',
      'source', 'ok',
      'checked_at', v_now,
      'window_end', null,
      'health', v_current->'health'
    );
    update public.site_settings
      set value = v_next, updated_at = v_now
      where key = 'ppsr_status';
    return v_next;
  end if;

  return coalesce(v_current, v_window);
end;
$function$;

revoke all on function private.apply_ppsr_schedule() from public, anon, authenticated;

do $cron$
declare
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'imdrivn-ppsr-schedule';
  if v_id is null then
    v_id := cron.schedule('imdrivn-ppsr-schedule', '*/5 * * * *', 'select private.apply_ppsr_schedule()');
  else
    perform cron.alter_job(v_id, schedule := '*/5 * * * *');
  end if;
end
$cron$;
