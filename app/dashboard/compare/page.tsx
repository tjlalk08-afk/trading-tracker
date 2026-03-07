"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

type HistoryRow = {
  id: number;
  snapshot_ts: string;

  cash: number | null;
  realized_pl: number | null;
  open_pl: number | null;
  total_pl: number | null;
  equity: number | null;

  live_cash: number | null;
  live_realized_pl: number | null;
  live_open_pl: number | null;
  live_total_pl: number | null;
  live_equity: number | null;

  test_cash: number | null;
  test_realized_pl: number | null;
  test_open_pl: number | null;
  test_total_pl: number | null;
  test_equity: number | null;

  created_at: string;
};

type HistoryPayload = {
  ok: boolean;
  data?: HistoryRow[];
  error?: string;
};

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

function pct(n: number | null | undefined) {
  return `${Number(n ?? 0).toFixed(2)}%`;
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wider opacity-60">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs opacity-60">{sub}</div> : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="text-[11px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function getLocalDayKey(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString([], {
    month: "numeric",
    day: "numeric",
  });
}

function calcMaxDrawdown(values: number[]) {
  if (values.length === 0) return { amount: 0, pct: 0 };

  let peak = values[0];
  let maxAmount = 0;
  let maxPct = 0;

  for (const value of values) {
    if (value > peak) peak = value;

    const drawdownAmount = peak - value;
    const drawdownPct = peak !== 0 ? (drawdownAmount / peak) * 100 : 0;

    if (drawdownAmount > maxAmount) {
      maxAmount = drawdownAmount;
      maxPct = drawdownPct;
    }
  }

  return { amount: maxAmount, pct: maxPct };
}

export default function ComparePage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadHistory() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/dashboard-history", {
        cache: "no-store",
      });

      const json: HistoryPayload = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load dashboard history");
      }

      setRows(json.data ?? []);
    } catch (err: any) {
      setError(err?.message || "Failed to load compare history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  const dailyRows = useMemo(() => {
    const map = new Map<string, HistoryRow>();

    for (const row of rows) {
      const key = getLocalDayKey(row.snapshot_ts);
      const existing = map.get(key);

      if (!existing) {
        map.set(key, row);
        continue;
      }

      if (
        new Date(row.snapshot_ts).getTime() >
        new Date(existing.snapshot_ts).getTime()
      ) {
        map.set(key, row);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(a.snapshot_ts).getTime() - new Date(b.snapshot_ts).getTime()
    );
  }, [rows]);

  const chartData = useMemo(() => {
    return dailyRows.map((row) => {
      const liveTotal = Number(row.live_total_pl ?? row.total_pl ?? 0);
      const testTotal = Number(row.test_total_pl ?? 0);

      return {
        label: formatDayLabel(row.snapshot_ts),
        snapshotTs: row.snapshot_ts,
        liveTotal,
        testTotal,
      };
    });
  }, [dailyRows]);

  const last = rows[rows.length - 1];

  const latestLiveEquity = Number(last?.live_equity ?? last?.equity ?? 0);
  const latestTestEquity = Number(last?.test_equity ?? 0);
  const latestLiveTotal = Number(last?.live_total_pl ?? last?.total_pl ?? 0);
  const latestTestTotal = Number(last?.test_total_pl ?? 0);
  const latestLiveRealized = Number(last?.live_realized_pl ?? 0);
  const latestTestRealized = Number(last?.test_realized_pl ?? 0);
  const latestLiveOpen = Number(last?.live_open_pl ?? 0);
  const latestTestOpen = Number(last?.test_open_pl ?? 0);
  const latestLiveCash = Number(last?.live_cash ?? 0);
  const latestTestCash = Number(last?.test_cash ?? 0);

  const equityGap = latestLiveEquity - latestTestEquity;
  const totalGap = latestLiveTotal - latestTestTotal;
  const realizedGap = latestLiveRealized - latestTestRealized;
  const openGap = latestLiveOpen - latestTestOpen;

  const liveEquitySeries = rows.map((r) => Number(r.live_equity ?? r.equity ?? 0));
  const testTotalSeries = rows.map((r) => Number(r.test_total_pl ?? 0));

  const liveMaxDd = calcMaxDrawdown(liveEquitySeries);
  const testMaxDd = calcMaxDrawdown(testTotalSeries);

  const headline =
    totalGap === 0
      ? "Live and test are tied right now."
      : totalGap > 0
      ? "Live is ahead of test right now."
      : "Test is ahead of live right now.";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Compare</h1>
        <div className="text-sm opacity-70">
          Live vs test comparison from saved bot snapshots.
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm opacity-70">
          Loading compare history...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm opacity-70">
          No saved snapshot history yet. Refresh Snapshot a few times first.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm opacity-80">
            {headline}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard
              title="Equity Gap"
              value={money(equityGap)}
              sub="Live equity minus test equity"
            />
            <StatCard
              title="Total P/L Gap"
              value={money(totalGap)}
              sub="Live total minus test total"
            />
            <StatCard
              title="Realized Gap"
              value={money(realizedGap)}
              sub="Live realized minus test realized"
            />
            <StatCard
              title="Open P/L Gap"
              value={money(openGap)}
              sub="Live open minus test open"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div>
                <div className="text-lg font-semibold">Live</div>
                <div className="text-xs opacity-70">
                  Latest saved live snapshot.
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <MiniStat label="Equity" value={money(latestLiveEquity)} />
                <MiniStat label="Realized" value={money(latestLiveRealized)} />
                <MiniStat label="Open" value={money(latestLiveOpen)} />
                <MiniStat label="Total" value={money(latestLiveTotal)} />
                <MiniStat label="Cash" value={money(latestLiveCash)} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div>
                <div className="text-lg font-semibold">Test</div>
                <div className="text-xs opacity-70">
                  Latest saved test snapshot.
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <MiniStat label="Equity" value={money(latestTestEquity)} />
                <MiniStat label="Realized" value={money(latestTestRealized)} />
                <MiniStat label="Open" value={money(latestTestOpen)} />
                <MiniStat label="Total" value={money(latestTestTotal)} />
                <MiniStat label="Cash" value={money(latestTestCash)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard title="Days Tracked" value={String(dailyRows.length)} />
            <StatCard
              title="Live Max Drawdown"
              value={money(liveMaxDd.amount)}
              sub={pct(liveMaxDd.pct)}
            />
            <StatCard
              title="Test Max Drawdown"
              value={money(testMaxDd.amount)}
              sub={`${pct(testMaxDd.pct)} • from test total P/L snapshots`}
            />
            <StatCard
              title="Cash Gap"
              value={money(latestLiveCash - latestTestCash)}
              sub="Live cash minus test cash"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4">
              <div className="text-2xl font-semibold">Daily Live vs Test Totals</div>
              <div className="text-sm opacity-70">
                One saved point per day using the latest snapshot from each day.
              </div>
            </div>

            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="label" stroke="#888" />
                  <YAxis
                    stroke="#888"
                    tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111111",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                    formatter={(
                      value: number | string | undefined,
                      name: string | undefined
                    ) => {
                      const amount = Number(value ?? 0);
                      const label = name ?? "";

                      if (label === "liveTotal") return [money(amount), "Live Total P/L"];
                      if (label === "testTotal") return [money(amount), "Test Total P/L"];
                      return [money(amount), label];
                    }}
                    labelFormatter={(label, payload) => {
                      const point = payload?.[0]?.payload as
                        | { snapshotTs?: string }
                        | undefined;
                      return point?.snapshotTs ?? String(label);
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="liveTotal"
                    name="Live Total P/L"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="testTotal"
                    name="Test Total P/L"
                    fill="#38bdf8"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}