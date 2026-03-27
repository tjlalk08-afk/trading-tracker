alter table if exists public.dashboard_snapshots
  add column if not exists mode text;

update public.dashboard_snapshots
set mode = 'live'
where mode is null;

alter table if exists public.dashboard_snapshots
  alter column mode set default 'live';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dashboard_snapshots_mode_check'
  ) then
    alter table public.dashboard_snapshots
      add constraint dashboard_snapshots_mode_check
      check (mode in ('live', 'paper'));
  end if;
end
$$;

create index if not exists dashboard_snapshots_mode_snapshot_ts_idx
  on public.dashboard_snapshots (mode, snapshot_ts desc);

alter table if exists public.trade_history
  add column if not exists mode text;

update public.trade_history
set mode = case
  when source = 'brother_test' then 'paper'
  else 'live'
end
where mode is null;

alter table if exists public.trade_history
  alter column mode set default 'live';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trade_history_mode_check'
  ) then
    alter table public.trade_history
      add constraint trade_history_mode_check
      check (mode in ('live', 'paper'));
  end if;
end
$$;

create index if not exists trade_history_mode_trade_day_idx
  on public.trade_history (mode, trade_day desc, closed_at desc);
