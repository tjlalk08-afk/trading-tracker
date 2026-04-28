"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Target, Zap, Award } from "lucide-react";
import { formatMonth, loadTrades, money, numberValue, pnlClass, summarizeTrades, type Trade } from "./data";

export default function Performance() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        setTrades(await loadTrades("all", 1000, controller.signal, "live"));
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load performance.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const summary = useMemo(() => summarizeTrades(trades), [trades]);
  const monthly = useMemo(() => {
    const byMonth = new Map<string, { month: string; profit: number; trades: number }>();
    for (const trade of trades) {
      const key = (trade.trade_day ?? trade.closed_at ?? "").slice(0, 7) || "Unknown";
      const row = byMonth.get(key) ?? { month: formatMonth(`${key}-01`), profit: 0, trades: 0 };
      row.profit += numberValue(trade.realized_pl);
      row.trades += 1;
      byMonth.set(key, row);
    }
    return Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, row]) => row);
  }, [trades]);

  const grossWins = trades.filter((trade) => numberValue(trade.realized_pl) > 0).reduce((sum, trade) => sum + numberValue(trade.realized_pl), 0);
  const grossLosses = Math.abs(trades.filter((trade) => numberValue(trade.realized_pl) < 0).reduce((sum, trade) => sum + numberValue(trade.realized_pl), 0));
  const profitFactor = grossLosses ? grossWins / grossLosses : grossWins ? grossWins : 0;
  const best = [...trades].sort((a, b) => numberValue(b.realized_pl) - numberValue(a.realized_pl))[0];
  const worst = [...trades].sort((a, b) => numberValue(a.realized_pl) - numberValue(b.realized_pl))[0];
  const consistency = monthly.length ? (monthly.filter((row) => row.profit > 0).length / monthly.length) * 100 : 0;
  const maxDrawdown = worst ? numberValue(worst.realized_pl) : 0;

  if (loading) return <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900 p-8 text-zinc-400">Loading real performance metrics...</div>;
  if (error) return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">{error}</div>;

  const metrics = [
    { label: "Win Rate", value: `${summary.winRate.toFixed(1)}%`, change: `${summary.wins} wins`, icon: Target, iconWrapClass: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10", iconClass: "text-emerald-400" },
    { label: "Max Drawdown", value: money(maxDrawdown), change: worst?.symbol ?? "-", icon: TrendingUp, iconWrapClass: "bg-gradient-to-br from-blue-500/20 to-blue-600/10", iconClass: "text-blue-400" },
    { label: "Profit Factor", value: profitFactor.toFixed(2), change: money(grossWins), icon: Zap, iconWrapClass: "bg-gradient-to-br from-purple-500/20 to-purple-600/10", iconClass: "text-purple-400" },
    { label: "Closed Trades", value: String(trades.length), change: summary.avgDuration, icon: Award, iconWrapClass: "bg-gradient-to-br from-amber-500/20 to-amber-600/10", iconClass: "text-amber-400" },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">Performance Metrics</h1>
        <p className="text-zinc-400">Advanced analytics from your real trade history</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, idx) => (
          <motion.div key={metric.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} whileHover={{ y: -4 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700/50 shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300">
            <div className="flex items-start justify-between mb-4"><div className={`p-3 ${metric.iconWrapClass} rounded-xl`}><metric.icon className={`w-6 h-6 ${metric.iconClass}`} /></div><div className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold">{metric.change}</div></div>
            <div className="text-zinc-400 text-sm mb-2">{metric.label}</div><div className={`text-3xl font-bold ${metric.label === "Max Drawdown" ? pnlClass(maxDrawdown) : "text-white"}`}>{metric.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl">
          <div className="mb-6"><h3 className="text-2xl font-bold mb-1">Monthly Profit Trend</h3><p className="text-sm text-zinc-400">6-month realized performance</p></div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthly}><defs><linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} /><XAxis dataKey="month" stroke="#9ca3af" /><YAxis stroke="#9ca3af" /><Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "12px" }} labelStyle={{ color: "#fff" }} formatter={(value: number | string | undefined) => money(value)} /><Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fill="url(#profitGradient)" /></AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl">
          <div className="mb-6"><h3 className="text-2xl font-bold mb-1">Monthly Trade Volume</h3><p className="text-sm text-zinc-400">Closed trades by month</p></div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} /><XAxis dataKey="month" stroke="#9ca3af" /><YAxis stroke="#9ca3af" /><Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "12px" }} labelStyle={{ color: "#fff" }} /><Bar dataKey="trades" fill="#10b981" radius={[8, 8, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl">
        <h3 className="text-2xl font-bold mb-8">Performance Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 bg-zinc-800/50 rounded-xl"><div className="text-sm text-zinc-400 mb-2">Average Win</div><div className="text-3xl font-bold text-emerald-400 mb-1">{money(summary.avgWin)}</div><div className="text-xs text-zinc-400">Per winning trade</div></div>
          <div className="p-6 bg-zinc-800/50 rounded-xl"><div className="text-sm text-zinc-400 mb-2">Average Loss</div><div className="text-3xl font-bold text-red-400 mb-1">{money(summary.avgLoss)}</div><div className="text-xs text-zinc-400">Per losing trade</div></div>
          <div className="p-6 bg-zinc-800/50 rounded-xl"><div className="text-sm text-zinc-400 mb-2">Realized P/L</div><div className={`text-3xl font-bold mb-1 ${pnlClass(summary.realized)}`}>{money(summary.realized)}</div><div className="text-xs text-zinc-400">Across loaded trades</div></div>
          <div className="p-6 bg-zinc-800/50 rounded-xl"><div className="text-sm text-zinc-400 mb-2">Best Trade</div><div className="text-3xl font-bold text-emerald-400 mb-1">{best ? money(best.realized_pl) : "-"}</div><div className="text-xs text-zinc-400">{best?.symbol ?? "-"}</div></div>
          <div className="p-6 bg-zinc-800/50 rounded-xl"><div className="text-sm text-zinc-400 mb-2">Worst Trade</div><div className="text-3xl font-bold text-red-400 mb-1">{worst ? money(worst.realized_pl) : "-"}</div><div className="text-xs text-zinc-400">{worst?.symbol ?? "-"}</div></div>
          <div className="p-6 bg-zinc-800/50 rounded-xl"><div className="text-sm text-zinc-400 mb-2">Consistency</div><div className="text-3xl font-bold text-purple-400 mb-1">{consistency.toFixed(0)}%</div><div className="text-xs text-zinc-400">Profitable months</div></div>
        </div>
      </motion.div>
    </div>
  );
}
