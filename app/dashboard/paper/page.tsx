"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Snapshot = {
  snapshot_ts: string;
  updated_text?: string | null;
  equity: number;
  total_pl: number;
  realized_pl: number;
  open_pl: number;
};

type TradeRow = {
  id?: string | number | null;
  symbol?: string | null;
  side?: string | null;
  qty?: number | string | null;
  entry_price?: number | string | null;
  exit_price?: number | string | null;
  realized_pl?: number | null;
  closed_at?: string | null;
  trade_day?: string | null;
  source?: string | null;
  external_trade_id?: string | null;
};

type LatestPayload = {
  ok: boolean;
  data?: Snapshot | null;
  error?: string;
};

type HistoryPayload = {
  ok: boolean;
  data?: Snapshot[];
  error?: string;
};

type TradeHistoryPayload = {
  ok: boolean;
  data?: TradeRow[];
  error?: string;
};

type ChartPoint = {
  label: string;
  snapshotTs: string;
  equity: number;
};

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

function signedMoney(n: number | null | undefined) {
  const value = Number(n ?? 0);
  const abs = money(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function pnlTextClass(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (n > 0) return "text-emerald-300";
  if (n < 0) return "text-red-300";
  return "text-white";
}

function timeAgo(value: string | null | undefined) {
  if (!value) return "--";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return "--";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function chicagoDayKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const map = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return `${map.year}-${map.month}-${map.day}`;
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-white/10",
        "bg-[linear-gradient(180deg,rgba(18,24,33,0.88),rgba(8,11,17,0.94))]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_12px_30px_rgba(0,0,0,0.28)]",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_26%),radial-gradient(circle_at_bottom_center,rgba(16,185,129,0.04),transparent_30%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  tone = "text-white",
}: {
  title: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <Surface className="p-3.5">
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">{title}</div>
      <div className={`mt-2 text-[1.6rem] font-semibold ${tone}`}>{value}</div>
      <div className="mt-1.5 text-sm text-white/55">{sub}</div>
    </Surface>
  );
}

export default function PaperPage() {
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [latestRes, historyRes, tradesRes] = await Promise.all([
          fetch("/api/dashboard-latest?mode=paper", { cache: "no-store" }),
          fetch("/api/dashboard-history?mode=paper&days=365&limit=500", { cache: "no-store" }),
          fetch("/api/trade-history?mode=paper&range=30d&limit=100", { cache: "no-store" }),
        ]);

        const latestJson = (await latestRes.json()) as LatestPayload;
        const historyJson = (await historyRes.json()) as HistoryPayload;
        const tradesJson = (await tradesRes.json()) as TradeHistoryPayload;

        if (!latestRes.ok || !latestJson.ok) {
          throw new Error(latestJson.error || "Failed to load latest paper snapshot.");
        }
        if (!historyRes.ok || !historyJson.ok) {
          throw new Error(historyJson.error || "Failed to load paper history.");
        }
        if (!tradesRes.ok || !tradesJson.ok) {
          throw new Error(tradesJson.error || "Failed to load paper trades.");
        }

        setLatest(latestJson.data ?? null);
        setHistory(historyJson.data ?? []);
        setTrades(tradesJson.data ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load paper dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const dailyRows = useMemo(() => {
    const map = new Map<string, Snapshot>();
    for (const row of history) {
      const key = chicagoDayKey(row.snapshot_ts);
      const existing = map.get(key);
      if (!existing || new Date(row.snapshot_ts).getTime() > new Date(existing.snapshot_ts).getTime()) {
        map.set(key, row);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.snapshot_ts).getTime() - new Date(b.snapshot_ts).getTime(),
    );
  }, [history]);

  const chartData = useMemo<ChartPoint[]>(
    () =>
      dailyRows.map((row) => ({
        label: formatDayLabel(row.snapshot_ts),
        snapshotTs: row.snapshot_ts,
        equity: Number(row.equity ?? 0),
      })),
    [dailyRows],
  );

  const chartDomain = useMemo(() => {
    const values = chartData.map((point) => point.equity).filter((value) => Number.isFinite(value));
    if (values.length === 0) return ["auto", "auto"] as const;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min;
    const padding = Math.max(spread * 0.25, 40);
    return [Math.floor(min - padding), Math.ceil(max + padding)] as const;
  }, [chartData]);

  const tradeSummary = useMemo(() => {
    const net = trades.reduce((sum, row) => sum + Number(row.realized_pl ?? 0), 0);
    return {
      count: trades.length,
      net,
    };
  }, [trades]);

  if (loading) {
    return <Surface className="p-5 text-sm text-white/60">Loading paper mode...</Surface>;
  }

  if (error) {
    return (
      <Surface className="border-red-400/20 bg-red-500/10 p-5">
        <div className="text-sm text-red-300">{error}</div>
      </Surface>
    );
  }

  if (!latest) {
    return (
      <Surface className="p-5">
        <div className="text-xl font-semibold text-white">No paper-trading snapshots yet</div>
        <div className="mt-2 text-sm text-white/58">
          When the upstream account resets to the paper balance, snapshots and trades will start showing up here instead of affecting the live dashboard.
        </div>
      </Surface>
    );
  }

  return (
    <div className="relative isolate space-y-2 overflow-hidden pt-1">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(circle_at_10%_0%,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_90%_0%,rgba(99,102,241,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.06),transparent_30%)]" />

      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tight text-white xl:text-4xl">Paper</h1>
            <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300">
              Sim Mode
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3.5 py-2 text-sm text-cyan-300">
          Last paper snapshot <span className="font-medium text-white">{timeAgo(latest.snapshot_ts)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <StatCard title="Paper Equity" value={money(latest.equity)} sub={`Source updated ${formatDate(latest.updated_text)}`} />
        <StatCard title="Paper Total P/L" value={signedMoney(latest.total_pl)} sub="Latest saved paper result" tone={pnlTextClass(latest.total_pl)} />
        <StatCard title="Recent Paper Trades" value={String(tradeSummary.count)} sub="Loaded from paper mode only" />
        <StatCard title="30D Trade P/L" value={signedMoney(tradeSummary.net)} sub="Paper closed trades only" tone={pnlTextClass(tradeSummary.net)} />
      </div>

      <Surface className="p-3.5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Paper Equity Trend</div>
          <div className="mt-1 text-[1.35rem] font-semibold text-white">Saved paper-session history</div>
        </div>

        <div className="mt-3 h-[260px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="rgba(255,255,255,0.45)"
                minTickGap={24}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.45)"
                domain={chartDomain}
                tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(8, 12, 18, 0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 16,
                }}
                formatter={(value: number | string | undefined) => [money(Number(value ?? 0)), "Paper Equity"]}
                labelFormatter={(_label, payload) => {
                  const point = payload?.[0]?.payload as { snapshotTs?: string } | undefined;
                  return point?.snapshotTs ? formatDate(point.snapshotTs) : String(_label);
                }}
              />
              <Line type="monotone" dataKey="equity" stroke="#38bdf8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Surface>

      <Surface className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Recent Paper Trades</div>
          <div className="mt-1 text-[1.35rem] font-semibold text-white">Latest closed paper trades</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/45">
                <th className="px-4 py-3 font-medium">Closed</th>
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-4 py-3 font-medium">Side</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right">Entry</th>
                <th className="px-4 py-3 font-medium text-right">Exit</th>
                <th className="px-4 py-3 font-medium text-right">Realized</th>
              </tr>
            </thead>
            <tbody>
              {trades.length ? (
                trades.map((trade, index) => {
                  const realized = Number(trade.realized_pl ?? 0);
                  return (
                    <tr
                      key={String(trade.id ?? trade.external_trade_id ?? `${trade.symbol}-${index}`)}
                      className="border-b border-white/8 text-white/85 last:border-b-0"
                    >
                      <td className="px-4 py-4">{formatDate(trade.closed_at ?? trade.trade_day)}</td>
                      <td className="px-4 py-4 font-medium">{trade.symbol ?? "--"}</td>
                      <td className="px-4 py-4">{trade.side ?? "--"}</td>
                      <td className="px-4 py-4 text-right">{Number(trade.qty ?? 0)}</td>
                      <td className="px-4 py-4 text-right">{money(Number(trade.entry_price ?? 0))}</td>
                      <td className="px-4 py-4 text-right">{money(Number(trade.exit_price ?? 0))}</td>
                      <td className={`px-4 py-4 text-right font-medium ${pnlTextClass(realized)}`}>
                        {signedMoney(realized)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-white/50">
                    No paper trades saved yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  );
}
