"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Timeframe = "7D" | "30D" | "1Y";

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

type ChartPoint = {
  label: string;
  liveEquity: number;
  testTotalPl: number;
  liveTotalPl: number;
  snapshotTs: string;
};

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

function formatCompactMoney(n: number | null | undefined) {
  const value = Number(n ?? 0);
  const sign = value > 0 ? "+" : "";
  return `${sign}${money(value)}`;
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function getPerformanceTone(value: number) {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-white";
}

function getBadgeTone(value: number) {
  if (value > 0) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
  if (value < 0) {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }
  return "border-white/10 bg-white/5 text-white/70";
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

function formatSnapshotLabel(dateStr: string) {
  return new Date(dateStr).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRangeFromTimeframe(tf: Timeframe) {
  if (tf === "7D") return 7;
  if (tf === "30D") return 30;
  return 365;
}

function filterRowsByTimeframe(rows: HistoryRow[], timeframe: Timeframe) {
  if (rows.length === 0) return rows;

  const latestTs = new Date(rows[rows.length - 1].snapshot_ts).getTime();
  const days = getRangeFromTimeframe(timeframe);
  const cutoff = latestTs - (days - 1) * 24 * 60 * 60 * 1000;

  return rows.filter(
    (row) => new Date(row.snapshot_ts).getTime() >= cutoff,
  );
}

function StatCard({
  title,
  value,
  subLeft,
  subRight,
  tone = "text-white",
  badge,
}: {
  title: string;
  value: string;
  subLeft?: string;
  subRight?: string;
  tone?: string;
  badge?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:rounded-3xl sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
            {title}
          </div>
          <div className={`mt-2 text-2xl font-semibold sm:text-3xl ${tone}`}>{value}</div>
        </div>

        {badge ? (
          <div
            className={`rounded-full border px-2 py-1 text-[10px] font-medium sm:px-2.5 sm:text-[11px] ${
              tone === "text-emerald-400"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : tone === "text-red-400"
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "border-white/10 bg-white/5 text-white/70"
            }`}
          >
            {badge}
          </div>
        ) : null}
      </div>

      {(subLeft || subRight) && (
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/50 sm:mt-5 sm:text-sm">
          <span>{subLeft ?? ""}</span>
          <span>{subRight ?? ""}</span>
        </div>
      )}
    </div>
  );
}

export default function PerformancePage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("30D");
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
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard history";
      setError(message);
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
        new Date(a.snapshot_ts).getTime() - new Date(b.snapshot_ts).getTime(),
    );
  }, [rows]);

  const filteredRows = useMemo(
    () => filterRowsByTimeframe(dailyRows, timeframe),
    [dailyRows, timeframe],
  );

  const chartData = useMemo<ChartPoint[]>(() => {
    return filteredRows.map((row) => ({
      label: formatDayLabel(row.snapshot_ts),
      liveEquity: Number(row.live_equity ?? row.equity ?? 0),
      testTotalPl: Number(row.test_total_pl ?? 0),
      liveTotalPl: Number(row.live_total_pl ?? row.total_pl ?? 0),
      snapshotTs: row.snapshot_ts,
    }));
  }, [filteredRows]);

  const first = filteredRows[0];
  const last = filteredRows[filteredRows.length - 1];

  const liveStart = Number(first?.live_equity ?? first?.equity ?? 0);
  const liveNow = Number(last?.live_equity ?? last?.equity ?? 0);
  const liveChange = liveNow - liveStart;

  const latestTestTotal = Number(last?.test_total_pl ?? 0);
  const latestLiveTotal = Number(last?.live_total_pl ?? last?.total_pl ?? 0);

  const firstTs = first?.snapshot_ts ? formatSnapshotLabel(first.snapshot_ts) : "—";
  const lastTs = last?.snapshot_ts ? formatSnapshotLabel(last.snapshot_ts) : "—";

  const hasTestMovement = filteredRows.some(
    (row) => Math.abs(Number(row.test_total_pl ?? 0)) > 0.000001,
  );

  const liveFlat = Math.abs(liveChange) < 0.000001;

  const liveYAxisDomain = useMemo(() => {
    const values = chartData
      .map((d) => d.liveEquity)
      .filter((v) => Number.isFinite(v));

    if (values.length === 0) return ["auto", "auto"] as const;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min;
    const padding = Math.max(spread * 0.3, Math.abs(min || 1) * 0.01, 40);

    return [Math.floor(min - padding), Math.ceil(max + padding)] as const;
  }, [chartData]);

  const summary = useMemo(() => {
    const daysTracked = filteredRows.length;
    const bestLivePoint =
      chartData.length > 0
        ? Math.max(...chartData.map((p) => p.liveEquity))
        : 0;
    const worstTestPoint =
      chartData.length > 0
        ? Math.min(...chartData.map((p) => p.testTotalPl))
        : 0;

    return {
      daysTracked,
      liveNow,
      liveStart,
      liveChange,
      latestTestTotal,
      latestLiveTotal,
      bestLivePoint,
      worstTestPoint,
      latestLabel: last?.snapshot_ts
        ? new Date(last.snapshot_ts).toLocaleDateString([], {
            month: "numeric",
            day: "numeric",
          })
        : "—",
    };
  }, [filteredRows, chartData, last, liveNow, liveStart, liveChange, latestTestTotal, latestLiveTotal]);

  const infoMessages: string[] = [];
  if (!hasTestMovement) {
    infoMessages.push("Test line hidden because there is no saved test movement in this range.");
  }
  if (liveFlat) {
    infoMessages.push("Live equity is flat across the saved daily points in this range.");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-emerald-500/8 blur-[140px]" />
          <div className="absolute left-[-10%] top-[18%] h-[320px] w-[320px] rounded-full bg-cyan-500/6 blur-[120px]" />
          <div className="absolute right-[-10%] top-[8%] h-[320px] w-[320px] rounded-full bg-blue-500/6 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
              maskImage:
                "linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0.25) 70%, rgba(0,0,0,0))",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-8 pt-4 sm:px-5 sm:pb-10 sm:pt-6 md:px-6 md:pt-8">
          <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:rounded-[30px]">
            <div className="border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                    Snapshot Performance
                  </div>

                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                    Performance
                  </h1>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/60 md:text-[15px]">
                    Daily trend view built from saved Supabase snapshots. Live
                    equity is the primary signal, while test daily P/L is shown
                    as a secondary overlay when movement exists.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-white/45 sm:mt-5 sm:gap-3 sm:text-xs">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      {timeframe} window
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      One saved point per day
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      Snapshot-based history
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-1">
                    {(["7D", "30D", "1Y"] as Timeframe[]).map((tf) => {
                      const active = timeframe === tf;
                      return (
                        <button
                          key={tf}
                          onClick={() => setTimeframe(tf)}
                          className={`rounded-xl px-3 py-2 text-xs font-medium transition sm:px-4 sm:py-2.5 sm:text-sm ${
                            active
                              ? "bg-emerald-400 text-black shadow-[0_0_24px_rgba(52,211,153,0.25)]"
                              : "text-white/70 hover:bg-white/8 hover:text-white"
                          }`}
                        >
                          {tf}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <div className="px-6 pt-6 md:px-8">
                <div className="rounded-3xl border border-red-500/20 bg-red-500/8 p-6 text-center">
                  <div className="text-sm font-medium uppercase tracking-[0.2em] text-red-300">
                    Load Error
                  </div>
                  <div className="mt-3 text-base text-red-200">{error}</div>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="px-6 py-16 md:px-8">
                <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center">
                  <div className="mb-4 h-10 w-10 animate-pulse rounded-full border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(52,211,153,0.18)]" />
                  <div className="text-base font-medium text-white">
                    Loading performance history
                  </div>
                  <div className="mt-2 text-sm text-white/45">
                    Pulling saved dashboard snapshots and building daily trend
                    points.
                  </div>
                </div>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="px-6 py-16 md:px-8">
                <div className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl text-white/70">
                    ⌁
                  </div>
                  <h3 className="text-xl font-medium text-white">
                    No snapshot history in this range
                  </h3>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/50">
                    Save a few daily snapshots first, then this page will chart
                    live equity and test performance over time.
                  </p>
                </div>
              </div>
            ) : (
                <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 2xl:grid-cols-5">
                  <StatCard
                    title="Days Tracked"
                    value={String(summary.daysTracked)}
                    subLeft="Saved daily points"
                    subRight={summary.latestLabel}
                  />

                  <StatCard
                    title="Live Equity Now"
                    value={money(summary.liveNow)}
                    subLeft={`Start: ${money(summary.liveStart)}`}
                    subRight={`Best: ${money(summary.bestLivePoint)}`}
                  />

                  <StatCard
                    title="Live Change"
                    value={formatCompactMoney(summary.liveChange)}
                    tone={getPerformanceTone(summary.liveChange)}
                    badge={
                      summary.liveChange > 0
                        ? "Up"
                        : summary.liveChange < 0
                          ? "Down"
                          : "Flat"
                    }
                    subLeft={liveFlat ? "No live movement yet" : "Change since range start"}
                    subRight={formatPct(
                      summary.liveStart !== 0
                        ? (summary.liveChange / summary.liveStart) * 100
                        : 0,
                    )}
                  />

                  <StatCard
                    title="Test Total P/L"
                    value={money(summary.latestTestTotal)}
                    tone={getPerformanceTone(summary.latestTestTotal)}
                    badge={
                      summary.latestTestTotal > 0
                        ? "Positive"
                        : summary.latestTestTotal < 0
                          ? "Negative"
                          : "Flat"
                    }
                    subLeft="Latest saved row"
                    subRight={
                      hasTestMovement
                        ? `Worst: ${money(summary.worstTestPoint)}`
                        : "No test movement"
                    }
                  />

                  <StatCard
                    title="Latest Day"
                    value={summary.latestLabel}
                    subLeft={firstTs}
                    subRight={lastTs}
                  />
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:mt-6 sm:rounded-[28px]">
                  <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between sm:px-5 sm:py-4">
                    <div>
                      <h2 className="text-xl font-semibold text-white sm:text-2xl">
                        Live Equity Trend
                        <span className="text-white/45"> + Test Daily P/L</span>
                      </h2>
                      <p className="mt-1 text-sm text-white/45">
                        Left axis shows live equity. Right axis shows test daily
                        P/L when movement exists.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-white/45 sm:flex sm:flex-wrap sm:items-center">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                        Range: {firstTs} → {lastTs}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                        Live changed: {money(summary.liveChange)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                        Test now: {money(summary.latestTestTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 py-3 sm:px-5 sm:py-4">
                    {infoMessages.length > 0 ? (
                      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
                        {infoMessages.join(" ")}
                      </div>
                    ) : null}

                    <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-white/70">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        Live Equity
                      </div>

                      <div
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                          hasTestMovement
                            ? "border-white/10 bg-white/[0.03] text-white/70"
                            : "border-white/10 bg-white/[0.02] text-white/35"
                        }`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            hasTestMovement ? "bg-sky-400" : "bg-white/20"
                          }`}
                        />
                        Test Daily P/L
                      </div>
                    </div>

                    <div className="h-[320px] sm:h-[420px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid
                            stroke="rgba(255,255,255,0.08)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            stroke="rgba(255,255,255,0.45)"
                            minTickGap={24}
                            tickLine={false}
                            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                          />
                          <YAxis
                            yAxisId="left"
                            stroke="rgba(255,255,255,0.45)"
                            domain={liveYAxisDomain}
                            tickFormatter={(v) =>
                              `$${Number(v).toLocaleString()}`
                            }
                            tickLine={false}
                            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="rgba(255,255,255,0.45)"
                            domain={["auto", "auto"]}
                            tickFormatter={(v) =>
                              `$${Number(v).toLocaleString()}`
                            }
                            tickLine={false}
                            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "rgba(8, 12, 18, 0.95)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 16,
                              boxShadow:
                                "0 20px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
                            }}
                            formatter={(
                              value: number | string | undefined,
                              name: string | undefined,
                            ) => {
                              const amount = Number(value ?? 0);

                              if (name === "liveEquity") {
                                return [money(amount), "Live Equity"];
                              }
                              if (name === "testTotalPl") {
                                return [money(amount), "Test Daily P/L"];
                              }
                              if (name === "liveTotalPl") {
                                return [money(amount), "Live Total P/L"];
                              }
                              return [money(amount), name ?? "Value"];
                            }}
                            labelFormatter={(_label, payload) => {
                              const point = payload?.[0]?.payload as
                                | { snapshotTs?: string }
                                | undefined;
                              return point?.snapshotTs
                                ? new Date(point.snapshotTs).toLocaleString()
                                : String(_label);
                            }}
                          />

                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="liveEquity"
                            name="liveEquity"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />

                          {hasTestMovement ? (
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="testTotalPl"
                              name="testTotalPl"
                              stroke="#38bdf8"
                              strokeWidth={2.5}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          ) : null}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:mt-6 xl:gap-4">
                  <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                      Latest Totals
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                          Live Total P/L
                        </div>
                        <div
                          className={`mt-2 text-3xl font-semibold ${getPerformanceTone(
                            summary.latestLiveTotal,
                          )}`}
                        >
                          {money(summary.latestLiveTotal)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                          Test Total P/L
                        </div>
                        <div
                          className={`mt-2 text-3xl font-semibold ${getPerformanceTone(
                            summary.latestTestTotal,
                          )}`}
                        >
                          {money(summary.latestTestTotal)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                      Snapshot Notes
                    </div>
                    <div className="mt-4 space-y-3 text-sm text-white/55">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        This page is snapshot-based, so it shows one saved point
                        per day rather than every live poll.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        Compare should handle live versus test side-by-side
                        account analysis. Performance stays focused on timeline
                        behavior.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
