create extension if not exists pgcrypto;

create table if not exists public.trade_setups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_tags (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  label text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_journal_trades (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual',
  source_trade_id text unique,
  account text not null default 'live',
  trade_group_key text,
  symbol text not null,
  display_symbol text,
  asset_type text not null default 'option',
  strategy text,
  setup_id uuid references public.trade_setups(id) on delete set null,
  side text,
  opened_at timestamptz,
  closed_at timestamptz,
  entry_price numeric(18,6),
  exit_price numeric(18,6),
  quantity numeric(18,6),
  gross_pl numeric(18,2) not null default 0,
  fees numeric(18,2) not null default 0,
  net_pl numeric(18,2) generated always as (gross_pl - fees) stored,
  return_pct numeric(18,4),
  max_favorable_excursion numeric(18,2),
  max_adverse_excursion numeric(18,2),
  duration_minutes integer,
  status text not null default 'closed',
  conviction_score integer,
  execution_score integer,
  rules_followed boolean,
  imported_from_trade_history boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trade_journal_executions (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trade_journal_trades(id) on delete cascade,
  execution_type text not null,
  occurred_at timestamptz not null,
  symbol text not null,
  option_symbol text,
  side text,
  quantity numeric(18,6),
  price numeric(18,6),
  fees numeric(18,2) not null default 0,
  realized_pl numeric(18,2),
  broker_execution_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_journal_notes (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trade_journal_trades(id) on delete cascade,
  note_type text not null default 'post',
  title text,
  body text not null,
  mood text,
  lesson text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trade_journal_screenshots (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trade_journal_trades(id) on delete cascade,
  image_url text not null,
  caption text,
  shot_type text not null default 'chart',
  created_at timestamptz not null default now()
);

create table if not exists public.trade_journal_trade_tags (
  trade_id uuid not null references public.trade_journal_trades(id) on delete cascade,
  tag_id uuid not null references public.trade_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trade_id, tag_id)
);

create index if not exists idx_trade_journal_trades_closed_at
  on public.trade_journal_trades(closed_at desc);
create index if not exists idx_trade_journal_trades_symbol
  on public.trade_journal_trades(symbol);
create index if not exists idx_trade_journal_trades_account
  on public.trade_journal_trades(account);
create index if not exists idx_trade_journal_executions_trade_id
  on public.trade_journal_executions(trade_id, occurred_at);
create index if not exists idx_trade_journal_notes_trade_id
  on public.trade_journal_notes(trade_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_trade_journal_trades_updated_at on public.trade_journal_trades;
create trigger set_trade_journal_trades_updated_at
before update on public.trade_journal_trades
for each row
execute function public.set_updated_at();

drop trigger if exists set_trade_journal_notes_updated_at on public.trade_journal_notes;
create trigger set_trade_journal_notes_updated_at
before update on public.trade_journal_notes
for each row
execute function public.set_updated_at();

create or replace view public.trade_journal_overview as
select
  t.id,
  t.account,
  t.symbol,
  coalesce(t.display_symbol, t.symbol) as display_symbol,
  t.strategy,
  s.name as setup_name,
  t.side,
  t.opened_at,
  t.closed_at,
  t.entry_price,
  t.exit_price,
  t.quantity,
  t.gross_pl,
  t.fees,
  t.net_pl,
  t.return_pct,
  t.duration_minutes,
  t.rules_followed,
  t.conviction_score,
  t.execution_score,
  coalesce(
    string_agg(distinct tg.label, ', ' order by tg.label)
      filter (where tg.label is not null),
    ''
  ) as tags,
  (
    select n.body
    from public.trade_journal_notes n
    where n.trade_id = t.id
    order by n.created_at desc
    limit 1
  ) as latest_note
from public.trade_journal_trades t
left join public.trade_setups s on s.id = t.setup_id
left join public.trade_journal_trade_tags tt on tt.trade_id = t.id
left join public.trade_tags tg on tg.id = tt.tag_id
group by
  t.id,
  t.account,
  t.symbol,
  t.display_symbol,
  t.strategy,
  s.name,
  t.side,
  t.opened_at,
  t.closed_at,
  t.entry_price,
  t.exit_price,
  t.quantity,
  t.gross_pl,
  t.fees,
  t.net_pl,
  t.return_pct,
  t.duration_minutes,
  t.rules_followed,
  t.conviction_score,
  t.execution_score;

insert into public.trade_setups (code, name, description)
values
  ('BREAKOUT', 'Breakout', 'Momentum continuation through a key level.'),
  ('RECLAIM', 'Reclaim', 'Retake of a key intraday or daily level.'),
  ('REVERSAL', 'Reversal', 'Fade or reversal from an extended move.'),
  ('TREND', 'Trend Day', 'Trend continuation aligned with market direction.')
on conflict (code) do nothing;

insert into public.trade_tags (category, label, description)
values
  ('discipline', 'A+ Setup', 'The trade matched the intended playbook cleanly.'),
  ('discipline', 'Rule Break', 'The trade violated a documented rule.'),
  ('emotion', 'FOMO', 'Entered late from fear of missing the move.'),
  ('emotion', 'Revenge Trade', 'Trade entered emotionally after a loss.'),
  ('review', 'Good Exit', 'Exit quality was strong relative to the plan.'),
  ('review', 'Early Exit', 'Exited too early relative to the plan.')
on conflict (label) do nothing;
