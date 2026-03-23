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
  realized_pl: number;
  open_pl: number;
  total_pl: number;
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

type Timeframe = "7D" | "30D" | "1Y";

type ChartPoint = {
  label: string;
  snapshotTs: string;
  equity: number;
};

type MonthlyPoint = {
  key: string;
  label: string;
  value: number;
};

type TrendSummary = {
  bestMonth: MonthlyPoint | null;
  worstMonth: MonthlyPoint | null;
  averageMonth: number;
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
    month: "short",
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

function monthKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(value));

  const map = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return `${map.year}-${map.month}`;
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    year: "2-digit",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getRangeFromTimeframe(tf: Timeframe) {
  if (tf === "7D") return 7;
  if (tf === "30D") return 30;
  return 365;
}

function filterRowsByTimeframe(rows: Snapshot[], timeframe: Timeframe) {
  if (rows.length === 0) return rows;
  const latestDayKey = chicagoDayKey(rows[rows.length - 1].snapshot_ts);
  const cutoffDayKey = shiftDateKey(latestDayKey, -(getRangeFromTimeframe(timeframe) - 1));
  return rows.filter((row) => chicagoDayKey(row.snapshot_ts) >= cutoffDayKey);
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.07),transparent_26%),radial-gradient(circle_at_bottom_center,rgba(59,130,246,0.05),transparent_30%)]" />
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

export default function DashboardOverviewPage() {
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("30D");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [latestRes, historyRes] = await Promise.all([
          fetch("/api/dashboard-latest", { cache: "no-store" }),
          fetch("/api/dashboard-history?days=365&limit=1500", { cache: "no-store" }),
        ]);

        const latestJson = (await latestRes.json()) as LatestPayload;
        const historyJson = (await historyRes.json()) as HistoryPayload;

        if (!latestRes.ok || !latestJson.ok) {
          throw new Error(latestJson.error || "Failed to load latest snapshot.");
        }
        if (!historyRes.ok || !historyJson.ok) {
          throw new Error(historyJson.error || "Failed to load dashboard history.");
        }

        setLatest(latestJson.data ?? null);
        setHistory(historyJson.data ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
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

  const filteredRows = useMemo(() => filterRowsByTimeframe(dailyRows, timeframe), [dailyRows, timeframe]);

  const chartData = useMemo<ChartPoint[]>(
    () =>
      filteredRows.map((row) => ({
        label: formatDayLabel(row.snapshot_ts),
        snapshotTs: row.snapshot_ts,
        equity: Number(row.equity ?? 0),
      })),
    [filteredRows],
  );

  const summary = useMemo(() => {
    if (!latest) {
      return {
        today: 0,
        week: 0,
        month: 0,
        quarter: 0,
      };
    }

    const latestEquity = Number(latest.equity ?? 0);
    const weekBaseline = dailyRows[Math.max(0, dailyRows.length - 7)] ?? dailyRows[0];
    const monthBaseline = dailyRows[Math.max(0, dailyRows.length - 30)] ?? dailyRows[0];
    const quarterBaseline = dailyRows[Math.max(0, dailyRows.length - 90)] ?? dailyRows[0];

    return {
      today: Number(latest.total_pl ?? 0),
      week: latestEquity - Number(weekBaseline?.equity ?? latestEquity),
      month: latestEquity - Number(monthBaseline?.equity ?? latestEquity),
      quarter: latestEquity - Number(quarterBaseline?.equity ?? latestEquity),
    };
  }, [dailyRows, latest]);

  const monthlyPerformance = useMemo<MonthlyPoint[]>(() => {
    const grouped = new Map<string, Snapshot[]>();

    for (const row of dailyRows) {
      const key = monthKey(row.snapshot_ts);
      const rows = grouped.get(key) ?? [];
      rows.push(row);
      grouped.set(key, rows);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, rows]) => {
        const sorted = rows.sort(
          (a, b) => new Date(a.snapshot_ts).getTime() - new Date(b.snapshot_ts).getTime(),
        );
        const first = Number(sorted[0]?.equity ?? 0);
        const last = Number(sorted[sorted.length - 1]?.equity ?? 0);

        return {
          key,
          label: formatMonthLabel(key),
          value: last - first,
        };
      });
  }, [dailyRows]);

  const freshnessTone = useMemo(() => {
    const ageMs = latest ? Date.now() - new Date(latest.snapshot_ts).getTime() : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(ageMs)) {
      return {
        tone: "text-white/70 border-white/10 bg-white/[0.05]",
        label: "Freshness unknown",
      };
    }
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 24) {
      return {
        tone: "text-emerald-300 border-emerald-400/20 bg-emerald-500/10",
        label: "Fresh snapshot",
      };
    }
    if (ageHours < 72) {
      return {
        tone: "text-amber-300 border-amber-400/20 bg-amber-500/10",
        label: "Aging snapshot",
      };
    }
    return {
      tone: "text-red-300 border-red-400/20 bg-red-500/10",
      label: "Stale snapshot",
    };
  }, [latest]);

  const trendSummary = useMemo<TrendSummary>(() => {
    if (monthlyPerformance.length === 0) {
      return {
        bestMonth: null,
        worstMonth: null,
        averageMonth: 0,
      };
    }

    const sorted = [...monthlyPerformance].sort((a, b) => a.value - b.value);
    const total = monthlyPerformance.reduce((sum, point) => sum + point.value, 0);

    return {
      bestMonth: sorted[sorted.length - 1] ?? null,
      worstMonth: sorted[0] ?? null,
      averageMonth: total / monthlyPerformance.length,
    };
  }, [monthlyPerformance]);

  const chartDomain = useMemo(() => {
    const values = chartData.map((point) => point.equity).filter((value) => Number.isFinite(value));
    if (values.length === 0) return ["auto", "auto"] as const;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min;
    const padding = Math.max(spread * 0.2, Math.abs(min || 1) * 0.01, 40);
    return [Math.floor(min - padding), Math.ceil(max + padding)] as const;
  }, [chartData]);

  if (loading) {
    return <Surface className="p-5 text-sm text-white/60">Loading overview...</Surface>;
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
        <div className="text-xl font-semibold text-white">No snapshot saved yet</div>
        <div className="mt-2 text-sm text-white/58">
          Pull the first snapshot from your source dashboard and the overview will populate automatically.
        </div>
      </Surface>
    );
  }

  return (
    <div className="relative isolate space-y-2 overflow-hidden pt-1">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.08),transparent_30%)]" />

      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tight text-white xl:text-4xl">Overview</h1>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
              Investor View
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-sm text-white/70">
            Last saved <span className="font-medium text-white">{timeAgo(latest.snapshot_ts)}</span>
          </div>
          <div className={`rounded-xl border px-3.5 py-2 text-sm ${freshnessTone.tone}`}>
            {freshnessTone.label}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <StatCard title="Fund Equity" value={money(latest.equity)} sub={`Source updated ${formatDate(latest.updated_text)}`} />
        <StatCard title="Today" value={signedMoney(summary.today)} sub="Latest saved total P/L" tone={pnlTextClass(summary.today)} />
        <StatCard title="7 Day" value={signedMoney(summary.week)} sub="Saved equity change" tone={pnlTextClass(summary.week)} />
        <StatCard title="Month P/L" value={signedMoney(summary.month)} sub="Trailing 30-day saved change" tone={pnlTextClass(summary.month)} />
        <StatCard title="90 Day" value={signedMoney(summary.quarter)} sub="Saved equity change" tone={pnlTextClass(summary.quarter)} />
      </div>

      <Surface className="p-3.5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Performance</div>
            <div className="mt-1 text-[1.4rem] font-semibold text-white">Saved equity trend</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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
                  boxShadow:
                    "0 20px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
                formatter={(value: number | string | undefined) => [money(Number(value ?? 0)), "Equity"]}
                labelFormatter={(_label, payload) => {
                  const point = payload?.[0]?.payload as { snapshotTs?: string } | undefined;
                  return point?.snapshotTs ? formatDate(point.snapshotTs) : String(_label);
                }}
              />
              <Line
                type="monotone"
                dataKey="equity"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-[1.15fr_0.85fr]">
        <Surface className="p-3.5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Monthly</div>
            <div className="mt-1 text-[1.35rem] font-semibold text-white">Month P/L</div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {monthlyPerformance.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-white/55 sm:col-span-2 xl:col-span-3">
                Not enough saved history yet.
              </div>
            ) : (
              monthlyPerformance.map((point) => (
                <div
                  key={point.key}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
                >
                  <div className="text-sm text-white/70">{point.label}</div>
                  <div className={`text-sm font-semibold ${pnlTextClass(point.value)}`}>
                    {signedMoney(point.value)}
                  </div>
                </div>
              ))
            )}
          </div>
        </Surface>

        <Surface className="p-3.5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Trend Read</div>
            <div className="mt-1 text-[1.35rem] font-semibold text-white">Recent consistency</div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Best Month</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="text-sm text-white/70">{trendSummary.bestMonth?.label ?? "--"}</div>
                <div className={`text-sm font-semibold ${pnlTextClass(trendSummary.bestMonth?.value ?? 0)}`}>
                  {trendSummary.bestMonth ? signedMoney(trendSummary.bestMonth.value) : "--"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Worst Month</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="text-sm text-white/70">{trendSummary.worstMonth?.label ?? "--"}</div>
                <div className={`text-sm font-semibold ${pnlTextClass(trendSummary.worstMonth?.value ?? 0)}`}>
                  {trendSummary.worstMonth ? signedMoney(trendSummary.worstMonth.value) : "--"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Average Month</div>
              <div className={`mt-1 text-sm font-semibold ${pnlTextClass(trendSummary.averageMonth)}`}>
                {signedMoney(trendSummary.averageMonth)}
              </div>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}
