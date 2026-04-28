"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, TrendingUp, Activity, Target, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  formatDateTime,
  formatMonth,
  loadEvents,
  loadHistory,
  loadLatest,
  loadTrades,
  money,
  numberValue,
  pnlClass,
  signedMoney,
  signedPercent,
  summarizeTrades,
  type Snapshot,
  type Trade,
  type TradeEvent,
} from "./data";

type ChartPoint = {
  date: string;
  month: string;
  monthTick: string;
  equity: number;
};

type StatCardProps = {
  title: string;
  value: string;
  change?: string;
  icon: LucideIcon;
  trend: "up" | "down";
};

const StatCard = ({ title, value, change, icon: Icon, trend }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4 }}
    className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700/50 shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300"
  >
    <div className="flex items-start justify-between mb-4">
      <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl">
        <Icon className="w-6 h-6 text-emerald-400" />
      </div>
      {change ? (
        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${trend === "up" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
          {trend === "up" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          <span className="text-sm font-semibold">{change}</span>
        </div>
      ) : null}
    </div>
    <div className="text-zinc-400 text-sm mb-2">{title}</div>
    <div className="text-3xl font-bold text-white">{value}</div>
  </motion.div>
);

function dailyHistory(rows: Snapshot[]) {
  const byDay = new Map<string, Snapshot>();
  for (const row of rows) {
    if (!row.snapshot_ts) continue;
    const day = row.snapshot_ts.slice(0, 10);
    const existing = byDay.get(day);
    if (!existing || new Date(row.snapshot_ts).getTime() > new Date(existing.snapshot_ts ?? 0).getTime()) {
      byDay.set(day, row);
    }
  }
  return Array.from(byDay.values()).sort(
    (a, b) => new Date(a.snapshot_ts ?? 0).getTime() - new Date(b.snapshot_ts ?? 0).getTime(),
  );
}

function activityLabel(event: TradeEvent) {
  return event.event_type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function Overview() {
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [events, setEvents] = useState<TradeEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError("");
        const [latestData, historyData, tradesData, eventsData] = await Promise.all([
          loadLatest(controller.signal),
          loadHistory(controller.signal),
          loadTrades("30d", 200, controller.signal),
          loadEvents(8, controller.signal),
        ]);
        setLatest(latestData);
        setHistory(historyData);
        setTrades(tradesData);
        setEvents(eventsData);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load overview.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const dailyRows = useMemo(() => dailyHistory(history), [history]);
  const summary = useMemo(() => summarizeTrades(trades), [trades]);
  const chartData = useMemo<ChartPoint[]>(() => {
    const seenMonths = new Set<string>();

    return dailyRows.map((row) => {
      const date = row.snapshot_ts?.slice(0, 10) ?? "";
      const month = formatMonth(row.snapshot_ts);
      const monthTick = seenMonths.has(month) ? "" : month;
      seenMonths.add(month);

      return {
        date,
        month,
        monthTick,
        equity: numberValue(row.equity),
      };
    });
  }, [dailyRows]);
  const chartDomain = useMemo<[number, number] | ["auto", "auto"]>(() => {
    const values = chartData
      .map((point) => point.equity)
      .filter((value) => Number.isFinite(value));

    if (!values.length) return ["auto", "auto"];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const midpoint = (min + max) / 2;
    const halfRange = Math.max((max - min) / 2, Math.abs(midpoint) * 0.08, 100);

    return [
      Math.floor(midpoint - halfRange),
      Math.ceil(midpoint + halfRange),
    ];
  }, [chartData]);

  const equity = numberValue(latest?.equity);
  const todayPl = numberValue(latest?.total_pl);
  const firstEquity = numberValue(dailyRows[0]?.equity);
  const totalGrowth = equity - firstEquity;
  const avgGain = summary.wins ? summary.avgWin : 0;

  if (loading) {
    return <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900 p-8 text-zinc-400">Loading real dashboard data...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">{error}</div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          Welcome Back
        </h1>
        <p className="text-zinc-400">Here&apos;s what&apos;s happening with your portfolio today</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Balance" value={money(equity)} change={signedMoney(totalGrowth)} trend={totalGrowth >= 0 ? "up" : "down"} icon={DollarSign} />
        <StatCard title="Today's P/L" value={signedMoney(todayPl)} change={signedPercent(equity ? (todayPl / equity) * 100 : 0)} trend={todayPl >= 0 ? "up" : "down"} icon={TrendingUp} />
        <StatCard title="Trades This Month" value={String(trades.length)} change={`${summary.wins} wins`} trend={summary.realized >= 0 ? "up" : "down"} icon={Activity} />
        <StatCard title="Avg Winning Trade" value={money(avgGain)} change={summary.winRate ? `${summary.winRate.toFixed(1)}% win` : "No wins"} trend="up" icon={Target} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-bold mb-1">Account Balance Over Time</h3>
            <p className="text-sm text-zinc-400">Saved account equity from real snapshots</p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${pnlClass(totalGrowth)}`}>{signedMoney(totalGrowth)}</div>
            <div className="text-sm text-zinc-400">Total growth</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              tickFormatter={(value) => {
                const point = chartData.find((row) => row.date === value);
                return point?.monthTick ?? "";
              }}
            />
            <YAxis
              stroke="#9ca3af"
              domain={chartDomain}
              tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "12px" }}
              labelStyle={{ color: "#fff" }}
              labelFormatter={(value) => {
                const point = chartData.find((row) => row.date === value);
                return point ? `${point.month} ${String(value).slice(8, 10)}` : value;
              }}
              formatter={(value: number | string | undefined) => [money(value), "Account Balance"]}
            />
            <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={3} fill="url(#growthGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl"
      >
        <h3 className="text-2xl font-bold mb-6">Recent Activity</h3>
        <div className="space-y-4">
          {(events.length ? events : trades.slice(0, 4).map((trade, index) => ({
            id: index,
            symbol: trade.symbol ?? "-",
            event_time_utc: trade.closed_at ?? trade.trade_day ?? "",
            event_type: "trade_closed",
            mode: trade.mode ?? "live",
            is_test: trade.mode === "paper",
            side: trade.side ?? null,
            source: trade.source ?? "trade_history",
            notes: null,
            payload: { realized_pl: trade.realized_pl },
          }))).map((activity) => {
            const amount = numberValue(activity.payload?.realized_pl);
            return (
              <div key={`${activity.id}-${activity.event_time_utc}`} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl hover:bg-zinc-800 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-xl flex items-center justify-center">
                    <span className="font-bold text-sm">{activity.symbol}</span>
                  </div>
                  <div>
                    <div className="font-semibold">{activityLabel(activity)}</div>
                    <div className="text-sm text-zinc-400">{formatDateTime(activity.event_time_utc)}</div>
                  </div>
                </div>
                <div className={`text-lg font-bold ${pnlClass(amount)}`}>{amount ? signedMoney(amount) : activity.mode}</div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
