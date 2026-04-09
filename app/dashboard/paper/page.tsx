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
  live_cash?: number | null;
  live_equity?: number | null;
  live_realized_pl?: number | null;
  live_open_pl?: number | null;
  live_total_pl?: number | null;
  test_cash?: number | null;
  test_equity?: number | null;
  test_realized_pl?: number | null;
  test_open_pl?: number | null;
  test_total_pl?: number | null;
  live_realized_pnl?: number | null;
  live_open_pnl?: number | null;
  live_total_pnl?: number | null;
  test_realized_pnl?: number | null;
  test_open_pnl?: number | null;
  test_total_pnl?: number | null;
};

type BotDashboardPayload = {
  ok?: boolean;
  data?: Snapshot | null;
  error?: string;
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
  liveEquity: number;
  testEquity: number;
};

type TradeComparisonRow = {
  key: string;
  symbol: string;
  side: string;
  qty: number;
  closedAt: string | null;
  live: TradeRow | null;
  test: TradeRow | null;
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

function normalizeTradeLane(source: string | null | undefined): "LIVE" | "TEST" | "OTHER" {
  const normalized = String(source ?? "").trim().toLowerCase();
  if (normalized.includes("live")) return "LIVE";
  if (normalized.includes("test") || normalized.includes("paper") || normalized.includes("sim")) return "TEST";
  return "OTHER";
}

function normalizeSnapshot(snapshot: Snapshot | null | undefined): Snapshot | null {
  if (!snapshot) return null;
  return {
    ...snapshot,
    live_realized_pl: snapshot.live_realized_pl ?? snapshot.live_realized_pnl ?? 0,
    live_open_pl: snapshot.live_open_pl ?? snapshot.live_open_pnl ?? 0,
    live_total_pl: snapshot.live_total_pl ?? snapshot.live_total_pnl ?? 0,
    test_realized_pl: snapshot.test_realized_pl ?? snapshot.test_realized_pnl ?? 0,
    test_open_pl: snapshot.test_open_pl ?? snapshot.test_open_pnl ?? 0,
    test_total_pl: snapshot.test_total_pl ?? snapshot.test_total_pnl ?? 0,
  };
}

export default function PaperPage() {
  const [currentSession, setCurrentSession] = useState<Snapshot | null>(null);
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

        const [currentRes, latestRes, historyRes, tradesRes] = await Promise.all([
          fetch("/api/bot/dashboard", { cache: "no-store" }),
          fetch("/api/dashboard-latest?mode=paper", { cache: "no-store" }),
          fetch("/api/dashboard-history?mode=paper&days=365&limit=500", { cache: "no-store" }),
          fetch("/api/trade-history?mode=paper&range=30d&limit=100", { cache: "no-store" }),
        ]);

        const currentJson = (await currentRes.json()) as BotDashboardPayload;
        const latestJson = (await latestRes.json()) as LatestPayload;
        const historyJson = (await historyRes.json()) as HistoryPayload;
        const tradesJson = (await tradesRes.json()) as TradeHistoryPayload;

        if (!currentRes.ok || currentJson.ok === false) {
          throw new Error(currentJson.error || "Failed to load current paper session.");
        }
        if (!latestRes.ok || !latestJson.ok) {
          throw new Error(latestJson.error || "Failed to load latest paper snapshot.");
        }
        if (!historyRes.ok || !historyJson.ok) {
          throw new Error(historyJson.error || "Failed to load paper history.");
        }
        if (!tradesRes.ok || !tradesJson.ok) {
          throw new Error(tradesJson.error || "Failed to load paper trades.");
        }

        setCurrentSession(normalizeSnapshot(currentJson.data ?? null));
        setLatest(normalizeSnapshot(latestJson.data ?? null));
        setHistory((historyJson.data ?? []).map((row) => normalizeSnapshot(row)!).filter(Boolean));
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

  const chartData = useMemo<ChartPoint[]>(() => {
    const rows = [...dailyRows];
    if (currentSession?.snapshot_ts) {
      const currentDay = chicagoDayKey(currentSession.snapshot_ts);
      const withoutCurrentDay = rows.filter((row) => chicagoDayKey(row.snapshot_ts) !== currentDay);
      withoutCurrentDay.push(currentSession);
      withoutCurrentDay.sort((a, b) => new Date(a.snapshot_ts).getTime() - new Date(b.snapshot_ts).getTime());
      return withoutCurrentDay.map((row) => ({
        label: formatDayLabel(row.snapshot_ts),
        snapshotTs: row.snapshot_ts,
        liveEquity: Number(row.live_equity ?? row.equity ?? 0),
        testEquity: Number(row.test_equity ?? 0),
      }));
    }

    return rows.map((row) => ({
      label: formatDayLabel(row.snapshot_ts),
      snapshotTs: row.snapshot_ts,
      liveEquity: Number(row.live_equity ?? row.equity ?? 0),
      testEquity: Number(row.test_equity ?? 0),
    }));
  }, [currentSession, dailyRows]);

  const chartDomain = useMemo(() => {
    const values = chartData
      .flatMap((point) => [point.liveEquity, point.testEquity])
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) return ["auto", "auto"] as const;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min;
    const padding = Math.max(spread * 0.25, 40);
    return [Math.floor(min - padding), Math.ceil(max + padding)] as const;
  }, [chartData]);

  const laneTradeSummary = useMemo(() => {
    const liveTrades = trades.filter((trade) => normalizeTradeLane(trade.source) === "LIVE");
    const testTrades = trades.filter((trade) => normalizeTradeLane(trade.source) === "TEST");
    return {
      live: {
        count: liveTrades.length,
        net: liveTrades.reduce((sum, row) => sum + Number(row.realized_pl ?? 0), 0),
        rows: liveTrades,
      },
      test: {
        count: testTrades.length,
        net: testTrades.reduce((sum, row) => sum + Number(row.realized_pl ?? 0), 0),
        rows: testTrades,
      },
    };
  }, [trades]);

  const comparisonRows = useMemo<TradeComparisonRow[]>(() => {
    const grouped = new Map<string, TradeComparisonRow>();

    for (const trade of trades) {
      const lane = normalizeTradeLane(trade.source);
      if (lane === "OTHER") continue;

      const closedAt = trade.closed_at ?? null;
      const minuteBucket = closedAt ? new Date(closedAt).toISOString().slice(0, 16) : trade.trade_day ?? "unknown";
      const key = [
        trade.symbol ?? "",
        trade.side ?? "",
        Number(trade.qty ?? 0),
        minuteBucket.slice(0, 10),
      ].join("|");

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          symbol: String(trade.symbol ?? "--"),
          side: String(trade.side ?? "--"),
          qty: Number(trade.qty ?? 0),
          closedAt,
          live: null,
          test: null,
        });
      }

      const row = grouped.get(key)!;
      row.closedAt = row.closedAt && closedAt
        ? (new Date(row.closedAt).getTime() > new Date(closedAt).getTime() ? row.closedAt : closedAt)
        : (row.closedAt ?? closedAt);

      if (lane === "LIVE") row.live = trade;
      if (lane === "TEST") row.test = trade;
    }

    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.closedAt ?? 0).getTime() - new Date(a.closedAt ?? 0).getTime(),
    );
  }, [trades]);

  const session = currentSession ?? latest;

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
        <StatCard title="Live Lane Equity" value={money(session?.live_equity)} sub={`Current paper live lane · ${formatDate(session?.updated_text)}`} />
        <StatCard title="Test Lane Equity" value={money(session?.test_equity)} sub={`Current paper test lane · ${formatDate(session?.updated_text)}`} />
        <StatCard title="Same-Trade Delta" value={signedMoney(Number(session?.live_realized_pl ?? 0) - Number(session?.test_realized_pl ?? 0))} sub="Live lane realized minus test lane realized" tone={pnlTextClass(Number(session?.live_realized_pl ?? 0) - Number(session?.test_realized_pl ?? 0))} />
        <StatCard title="Compared Trades" value={String(comparisonRows.length)} sub="Merged live-vs-test paper trades" />
      </div>

      <Surface className="p-3.5">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Paper Lane Comparison</div>
            <div className="mt-1 text-[1.35rem] font-semibold text-white">Live account vs test account</div>
            <div className="mt-1 text-sm text-white/55">
              Same paper session, compared by entry and exit behavior.
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Surface className="p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-white">Live Account Lane</div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                {laneTradeSummary.live.count} closed
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <StatCard title="Cash" value={money(session?.live_cash)} sub="Paper live lane" />
              <StatCard title="Equity" value={money(session?.live_equity)} sub="Paper live lane" />
              <StatCard title="Realized" value={signedMoney(session?.live_realized_pl)} sub="Current session" tone={pnlTextClass(session?.live_realized_pl)} />
              <StatCard title="Open" value={signedMoney(session?.live_open_pl)} sub="Current session" tone={pnlTextClass(session?.live_open_pl)} />
              <StatCard title="Total" value={signedMoney(session?.live_total_pl)} sub="Current session" tone={pnlTextClass(session?.live_total_pl)} />
              <StatCard title="30D Trade P/L" value={signedMoney(laneTradeSummary.live.net)} sub="Closed paper live-lane trades" tone={pnlTextClass(laneTradeSummary.live.net)} />
            </div>
          </Surface>

          <Surface className="p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-white">Test Account Lane</div>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-300">
                {laneTradeSummary.test.count} closed
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <StatCard title="Cash" value={money(session?.test_cash)} sub="Paper test lane" />
              <StatCard title="Equity" value={money(session?.test_equity)} sub="Paper test lane" />
              <StatCard title="Realized" value={signedMoney(session?.test_realized_pl)} sub="Current session" tone={pnlTextClass(session?.test_realized_pl)} />
              <StatCard title="Open" value={signedMoney(session?.test_open_pl)} sub="Current session" tone={pnlTextClass(session?.test_open_pl)} />
              <StatCard title="Total" value={signedMoney(session?.test_total_pl)} sub="Current session" tone={pnlTextClass(session?.test_total_pl)} />
              <StatCard title="30D Trade P/L" value={signedMoney(laneTradeSummary.test.net)} sub="Closed paper test-lane trades" tone={pnlTextClass(laneTradeSummary.test.net)} />
            </div>
          </Surface>
        </div>
      </Surface>

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
                formatter={(value: number | string | undefined, name: string | number | undefined) => [
                  money(Number(value ?? 0)),
                  name === "liveEquity" ? "Paper Live Lane" : "Paper Test Lane",
                ]}
                labelFormatter={(_label, payload) => {
                  const point = payload?.[0]?.payload as { snapshotTs?: string } | undefined;
                  return point?.snapshotTs ? formatDate(point.snapshotTs) : String(_label);
                }}
              />
              <Line type="monotone" dataKey="liveEquity" name="liveEquity" stroke="#34d399" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="testEquity" name="testEquity" stroke="#38bdf8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Surface>

      <Surface className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Compared Paper Trades</div>
          <div className="mt-1 text-[1.35rem] font-semibold text-white">Same trade, live lane vs test lane</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/45">
                <th className="px-4 py-3 font-medium">Closed</th>
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-4 py-3 font-medium">Side</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right">Live Entry</th>
                <th className="px-4 py-3 font-medium text-right">Live Exit</th>
                <th className="px-4 py-3 font-medium text-right">Live P/L</th>
                <th className="px-4 py-3 font-medium text-right">Test Entry</th>
                <th className="px-4 py-3 font-medium text-right">Test Exit</th>
                <th className="px-4 py-3 font-medium text-right">Test P/L</th>
                <th className="px-4 py-3 font-medium text-right">Delta</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.length ? (
                comparisonRows.map((trade, index) => {
                  const liveRealized = Number(trade.live?.realized_pl ?? 0);
                  const testRealized = Number(trade.test?.realized_pl ?? 0);
                  const delta = liveRealized - testRealized;
                  return (
                    <tr
                      key={trade.key ?? `${trade.symbol}-${index}`}
                      className="border-b border-white/8 text-white/85 last:border-b-0"
                    >
                      <td className="px-4 py-4">{formatDate(trade.closedAt)}</td>
                      <td className="px-4 py-4 font-medium">{trade.symbol ?? "--"}</td>
                      <td className="px-4 py-4">{trade.side ?? "--"}</td>
                      <td className="px-4 py-4 text-right">{trade.qty}</td>
                      <td className="px-4 py-4 text-right">{money(Number(trade.live?.entry_price ?? 0))}</td>
                      <td className="px-4 py-4 text-right">{money(Number(trade.live?.exit_price ?? 0))}</td>
                      <td className={`px-4 py-4 text-right font-medium ${pnlTextClass(liveRealized)}`}>
                        {signedMoney(liveRealized)}
                      </td>
                      <td className="px-4 py-4 text-right">{money(Number(trade.test?.entry_price ?? 0))}</td>
                      <td className="px-4 py-4 text-right">{money(Number(trade.test?.exit_price ?? 0))}</td>
                      <td className={`px-4 py-4 text-right font-medium ${pnlTextClass(testRealized)}`}>
                        {signedMoney(testRealized)}
                      </td>
                      <td className={`px-4 py-4 text-right font-medium ${pnlTextClass(delta)}`}>
                        {signedMoney(delta)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-white/50">
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
