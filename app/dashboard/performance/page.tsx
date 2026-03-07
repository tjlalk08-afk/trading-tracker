"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type HistoryRow = {
  id: number;
  snapshot_ts: string;
  equity: number | null;
  live_equity: number | null;
  test_equity: number | null;
  total_pl: number | null;
  live_total_pl: number | null;
  test_total_pl: number | null;
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

export default function PerformancePage() {
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
      setError(err?.message || "Failed to load dashboard history");
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
    return dailyRows.map((row) => ({
      label: formatDayLabel(row.snapshot_ts),
      liveEquity: Number(row.live_equity ?? row.equity ?? 0),
      testTotalPl: Number(row.test_total_pl ?? 0),
      liveTotalPl: Number(row.live_total_pl ?? row.total_pl ?? 0),
      snapshotTs: row.snapshot_ts,
    }));
  }, [dailyRows]);

  const first = dailyRows[0];
  const last = dailyRows[dailyRows.length - 1];

  const liveStart = Number(first?.live_equity ?? first?.equity ?? 0);
  const liveNow = Number(last?.live_equity ?? last?.equity ?? 0);
  const liveChange = liveNow - liveStart;

  const latestTestTotal = Number(last?.test_total_pl ?? 0);
  const latestLiveTotal = Number(last?.live_total_pl ?? last?.total_pl ?? 0);

  const firstTs = first?.snapshot_ts
    ? new Date(first.snapshot_ts).toLocaleString()
    : "—";
  const lastTs = last?.snapshot_ts
    ? new Date(last.snapshot_ts).toLocaleString()
    : "—";

  const hasTestMovement = dailyRows.some(
    (row) => Math.abs(Number(row.test_total_pl ?? 0)) > 0.000001
  );

  const liveFlat = Math.abs(liveChange) < 0.000001;

  const infoMessages: string[] = [];
  if (!hasTestMovement) {
    infoMessages.push("No test movement yet, so the test line is hidden.");
  }
  if (liveFlat) {
    infoMessages.push("No live equity change yet across saved daily snapshots.");
  }

  const liveYAxisDomain = useMemo(() => {
    const values = chartData
      .map((d) => Number(d.liveEquity))
      .filter((v) => Number.isFinite(v));

    if (values.length === 0) return ["auto", "auto"] as const;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min;

    const padding = Math.max(spread * 0.25, Math.abs(liveStart) * 0.01, 50);

    return [Math.floor(min - padding), Math.ceil(max + padding)] as const;
  }, [chartData, liveStart]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Performance</h1>
          <div className="text-sm opacity-70">
            Daily trend view built from saved Supabase snapshots.
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm opacity-70">
          Loading performance history...
        </div>
      ) : dailyRows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm opacity-70">
          No saved snapshot history yet. Pull a few snapshots first, then this page
          will chart them.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <StatCard title="Days Tracked" value={String(dailyRows.length)} />
            <StatCard
              title="Live Equity Now"
              value={money(liveNow)}
              sub={`Start: ${money(liveStart)}`}
            />
            <StatCard
              title="Live Change Since Start"
              value={money(liveChange)}
              sub={liveFlat ? "No live movement yet" : "Daily trend change"}
            />
            <StatCard
              title="Test Total P/L Now"
              value={money(latestTestTotal)}
              sub="Daily-reset model"
            />
            <StatCard title="Latest Day" value={formatDayLabel(last.snapshot_ts)} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4">
              <div className="text-2xl font-semibold">Live Equity Trend + Test Daily P/L</div>
              <div className="text-sm opacity-70">
                One saved point per day. Left axis = live equity. Right axis = test daily P/L.
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm">
                <span className="opacity-60">Range:</span> {firstTs} → {lastTs}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm">
                <span className="opacity-60">Live changed:</span> {money(liveChange)}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm">
                <span className="opacity-60">Test now:</span> {money(latestTestTotal)}
              </div>
            </div>

            {infoMessages.length > 0 ? (
              <div className="mb-4 rounded-xl border border-white/10 bg-black/10 p-3 text-sm opacity-70">
                {infoMessages.join(" ")}
              </div>
            ) : null}

            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="label" stroke="#888" minTickGap={24} />
                  <YAxis
                    yAxisId="left"
                    stroke="#888"
                    domain={liveYAxisDomain}
                    tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#888"
                    domain={["auto", "auto"]}
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

                      if (label === "liveEquity") {
                        return [money(amount), "Live Equity"];
                      }
                      if (label === "testTotalPl") {
                        return [money(amount), "Test Total P/L"];
                      }
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
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="liveEquity"
                    name="Live Equity"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                  {hasTestMovement ? (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="testTotalPl"
                      name="Test Total P/L"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={false}
                    />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4">
              <div className="text-xl font-semibold">Latest Totals</div>
              <div className="text-sm opacity-70">
                Snapshot-based totals from the most recent saved row.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StatCard title="Live Total P/L" value={money(latestLiveTotal)} />
              <StatCard title="Test Total P/L" value={money(latestTestTotal)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}