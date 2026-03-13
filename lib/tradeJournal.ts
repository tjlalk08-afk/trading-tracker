export type TradeJournalOverviewRow = {
  id: string;
  account: string | null;
  symbol: string | null;
  display_symbol: string | null;
  strategy: string | null;
  setup_name: string | null;
  side: string | null;
  opened_at: string | null;
  closed_at: string | null;
  entry_price: number | string | null;
  exit_price: number | string | null;
  quantity: number | string | null;
  gross_pl: number | string | null;
  fees: number | string | null;
  net_pl: number | string | null;
  return_pct: number | string | null;
  duration_minutes: number | null;
  rules_followed: boolean | null;
  conviction_score: number | null;
  execution_score: number | null;
  tags: string | null;
  latest_note: string | null;
};

export type TradeJournalSummary = {
  trades: number;
  winners: number;
  losers: number;
  winRate: number;
  netPl: number;
  avgNetPl: number;
  avgWinner: number;
  avgLoser: number;
};

export function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: unknown) {
  const amount = toNumber(value);
  const sign = amount > 0 ? "+" : "";
  return `${sign}$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: unknown) {
  return `${toNumber(value).toFixed(2)}%`;
}

export function summarizeJournal(rows: TradeJournalOverviewRow[]): TradeJournalSummary {
  const winners = rows.filter((row) => toNumber(row.net_pl) > 0);
  const losers = rows.filter((row) => toNumber(row.net_pl) < 0);
  const netPl = rows.reduce((sum, row) => sum + toNumber(row.net_pl), 0);

  return {
    trades: rows.length,
    winners: winners.length,
    losers: losers.length,
    winRate: rows.length ? (winners.length / rows.length) * 100 : 0,
    netPl,
    avgNetPl: rows.length ? netPl / rows.length : 0,
    avgWinner: winners.length
      ? winners.reduce((sum, row) => sum + toNumber(row.net_pl), 0) / winners.length
      : 0,
    avgLoser: losers.length
      ? losers.reduce((sum, row) => sum + toNumber(row.net_pl), 0) / losers.length
      : 0,
  };
}
