"use client";

export type Snapshot = {
  snapshot_ts?: string | null;
  updated_text?: string | null;
  equity?: number | string | null;
  realized_pl?: number | string | null;
  open_pl?: number | string | null;
  total_pl?: number | string | null;
  live_equity?: number | string | null;
  live_total_pl?: number | string | null;
  test_equity?: number | string | null;
  test_total_pl?: number | string | null;
};

export type Trade = {
  id?: string | number | null;
  snapshot_date?: string | null;
  trade_day?: string | null;
  symbol?: string | null;
  side?: string | null;
  qty?: number | string | null;
  entry_price?: number | string | null;
  exit_price?: number | string | null;
  realized_pl?: number | string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  source?: string | null;
  mode?: string | null;
  external_trade_id?: string | null;
};

export type SymbolRow = {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  flat: number;
  win_rate: number;
  realized_pl: number;
  avg_win: number;
  avg_loss: number;
};

export type TradeEvent = {
  id: number;
  event_time_utc: string;
  event_type: string;
  symbol: string;
  mode: string;
  is_test: boolean;
  side: string | null;
  source: string;
  notes: string | null;
  payload: Record<string, unknown> | null;
};

export type InvestorPnlData = {
  totalEquity: number;
  totalUnits: number;
  netContributedCapital: number;
  rows: Array<{
    id: string;
    name: string;
    role: string;
    netCashContributed: number;
    grantedUnits: number;
    totalUnits: number;
    ownershipPct: number;
    currentValue: number;
    pnlDollar: number;
    returnPct: number | null;
  }>;
};

type ApiPayload<T> = {
  ok: boolean;
  data?: T;
  rows?: T;
  summary?: Record<string, unknown>;
  error?: string;
};

export function numberValue(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function money(value: unknown, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(numberValue(value));
}

export function signedMoney(value: unknown) {
  const n = numberValue(value);
  const formatted = money(Math.abs(n));
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
}

export function percent(value: unknown, digits = 1) {
  return `${numberValue(value).toFixed(digits)}%`;
}

export function signedPercent(value: unknown, digits = 1) {
  const n = numberValue(value);
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function pnlClass(value: unknown, positive = "text-emerald-400") {
  const n = numberValue(value);
  if (n > 0) return positive;
  if (n < 0) return "text-red-400";
  return "text-zinc-300";
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatMonth(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
  }).format(date);
}

export function sideLabel(side: string | null | undefined) {
  const value = (side ?? "").toUpperCase();
  if (value.includes("PUT")) return "PUT";
  if (value.includes("CALL")) return "CALL";
  if (value.includes("SELL")) return "SELL";
  if (value.includes("BUY")) return "BUY";
  return value || "-";
}

export function avgTradeDuration(trades: Trade[]) {
  const durations = trades
    .map((trade) => {
      const opened = trade.opened_at ? new Date(trade.opened_at).getTime() : NaN;
      const closed = trade.closed_at ? new Date(trade.closed_at).getTime() : NaN;
      return Number.isFinite(opened) && Number.isFinite(closed) ? Math.max(0, closed - opened) : null;
    })
    .filter((value): value is number => value !== null);

  if (!durations.length) return "-";
  const avgMs = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const minutes = Math.round(avgMs / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

async function fetchJson<T>(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { cache: "no-store", signal });
  const json = (await res.json().catch(() => null)) as ApiPayload<T> | null;
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Failed to load ${url}`);
  }
  return json;
}

export async function loadLatest(signal?: AbortSignal) {
  const json = await fetchJson<Snapshot | null>("/api/dashboard-latest", signal);
  return json.data ?? null;
}

export async function loadHistory(signal?: AbortSignal) {
  const json = await fetchJson<Snapshot[]>("/api/dashboard-history?days=365&limit=1500", signal);
  return json.data ?? [];
}

export async function loadTrades(
  range = "all",
  limit = 500,
  signal?: AbortSignal,
  mode: "live" | "paper" | "all" = "live",
) {
  const json = await fetchJson<Trade[]>(`/api/trade-history?mode=${mode}&range=${range}&limit=${limit}`, signal);
  return json.data ?? [];
}

export type ManualTradeInput = {
  symbol: string;
  side: string;
  qty: number;
  entry_price: number;
  exit_price: number;
  realized_pl: number;
  opened_at?: string;
  closed_at: string;
  trade_day?: string;
  mode: "live" | "paper";
  strategy_name?: string;
};

export async function saveManualTrade(input: ManualTradeInput) {
  const res = await fetch("/api/trade-history/manual", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => null)) as ApiPayload<Trade> | null;
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Failed to save manual trade.");
  }
  return json.data;
}

export async function loadSymbols(range = "1y", signal?: AbortSignal, mode: "live" | "paper" | "all" = "live") {
  const json = await fetchJson<SymbolRow[]>(`/api/symbols?range=${range}&mode=${mode}`, signal);
  return {
    rows: (json.rows ?? []) as SymbolRow[],
    summary: json.summary ?? {},
  };
}

export async function loadEvents(limit = 50, signal?: AbortSignal, mode: "live" | "paper" | "test" | "all" = "live") {
  const modeParam = mode === "all" ? "" : `&mode=${mode}`;
  const json = await fetchJson<TradeEvent[]>(`/api/trade-events/query?limit=${limit}${modeParam}`, signal);
  return json.data ?? [];
}

export async function loadInvestorPnl(signal?: AbortSignal) {
  const json = await fetchJson<InvestorPnlData>("/api/investor-pnl", signal);
  return json.data ?? { totalEquity: 0, totalUnits: 0, netContributedCapital: 0, rows: [] };
}

export function summarizeTrades(trades: Trade[]) {
  const realized = trades.reduce((sum, trade) => sum + numberValue(trade.realized_pl), 0);
  const wins = trades.filter((trade) => numberValue(trade.realized_pl) > 0);
  const losses = trades.filter((trade) => numberValue(trade.realized_pl) < 0);
  const decisive = wins.length + losses.length;
  const winRate = decisive ? (wins.length / decisive) * 100 : 0;
  const best = [...trades].sort((a, b) => numberValue(b.realized_pl) - numberValue(a.realized_pl))[0] ?? null;
  const avgWin = wins.length ? wins.reduce((sum, trade) => sum + numberValue(trade.realized_pl), 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((sum, trade) => sum + numberValue(trade.realized_pl), 0) / losses.length : 0;

  return {
    realized,
    wins: wins.length,
    losses: losses.length,
    winRate,
    best,
    avgWin,
    avgLoss,
    avgDuration: avgTradeDuration(trades),
  };
}
