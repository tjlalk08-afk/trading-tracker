alter table if exists public.trade_journal_trades
  add column if not exists option_symbol text,
  add column if not exists chart_timeframe text not null default '5m',
  add column if not exists chart_symbol text;

create index if not exists idx_trade_journal_trades_option_symbol
  on public.trade_journal_trades(option_symbol);
