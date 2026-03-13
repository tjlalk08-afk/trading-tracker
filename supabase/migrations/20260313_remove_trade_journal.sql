drop view if exists public.trade_journal_overview;

drop trigger if exists set_trade_journal_notes_updated_at on public.trade_journal_notes;
drop trigger if exists set_trade_journal_trades_updated_at on public.trade_journal_trades;

drop table if exists public.trade_journal_trade_tags;
drop table if exists public.trade_journal_screenshots;
drop table if exists public.trade_journal_notes;
drop table if exists public.trade_journal_executions;
drop table if exists public.trade_journal_trades;
drop table if exists public.trade_tags;
drop table if exists public.trade_setups;

delete from storage.objects
where bucket_id = 'trade-journal';

delete from storage.buckets
where id = 'trade-journal';
