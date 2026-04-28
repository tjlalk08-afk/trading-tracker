"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PieChart as PieChartIcon, TrendingUp, Activity, Award } from "lucide-react";
import { formatMonth, loadSymbols, loadTrades, money, numberValue, pnlClass, summarizeTrades, type SymbolRow, type Trade } from "./data";

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#22d3ee"];

export default function Analytics() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        const [tradeRows, symbolData] = await Promise.all([
          loadTrades("all", 1000, controller.signal, "live"),
          loadSymbols("1y", controller.signal, "live"),
        ]);
        setTrades(tradeRows);
        setSymbols(symbolData.rows);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load analytics.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const monthlyPL = useMemo(() => {
    const byMonth = new Map<string, { month: string; profit: number; loss: number; net: number; trades: number; wins: number }>();
    for (const trade of trades) {
      const key = (trade.trade_day ?? trade.closed_at ?? "").slice(0, 7) || "Unknown";
      const row = byMonth.get(key) ?? { month: formatMonth(`${key}-01`), profit: 0, loss: 0, net: 0, trades: 0, wins: 0 };
      const pl = numberValue(trade.realized_pl);
      row.trades += 1;
      row.net += pl;
      if (pl > 0) {
        row.profit += pl;
        row.wins += 1;
      } else {
        row.loss += Math.abs(pl);
      }
      byMonth.set(key, row);
    }
    return Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, row]) => row);
  }, [trades]);

  const topSymbols = symbols.slice(0, 6).map((symbol, index) => ({
    name: symbol.symbol,
    value: Math.abs(symbol.realized_pl),
    raw: symbol.realized_pl,
    color: COLORS[index % COLORS.length],
  }));
  const totalSymbolValue = topSymbols.reduce((sum, item) => sum + item.value, 0);
  const winRateData = monthlyPL.map((row) => ({ month: row.month, rate: row.trades ? (row.wins / row.trades) * 100 : 0 }));
  const summary = summarizeTrades(trades);

  if (loading) return <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900 p-8 text-zinc-400">Loading real analytics...</div>;
  if (error) return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">{error}</div>;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          Analytics Dashboard
        </h1>
        <p className="text-zinc-400">Deep dive into your real trading performance</p>
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl">
            <TrendingUp className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Monthly Profit & Loss</h3>
            <p className="text-sm text-zinc-400">Real closed-trade breakdown</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {monthlyPL.map((month, idx) => (
            <motion.div key={month.month} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700 hover:border-zinc-600 transition-colors">
              <div className="text-sm text-zinc-400 mb-3">{month.month}</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs"><span className="text-zinc-500">Profit</span><span className="text-emerald-400 font-semibold">{money(month.profit)}</span></div>
                <div className="flex justify-between items-center text-xs"><span className="text-zinc-500">Loss</span><span className="text-red-400 font-semibold">{money(month.loss)}</span></div>
                <div className="h-px bg-zinc-700 my-2" />
                <div className="flex justify-between items-center"><span className="text-xs text-zinc-400">Net</span><span className={`font-bold text-lg ${pnlClass(month.net)}`}>{money(month.net)}</span></div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 rounded-xl">
            <PieChartIcon className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Ticker Earnings</h3>
            <p className="text-sm text-zinc-400">Realized P/L by symbol</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={topSymbols} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                {topSymbols.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "12px" }} formatter={(value: number | string | undefined) => money(value)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3">
            {topSymbols.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl">
                <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} /><span className="font-semibold">{item.name}</span></div>
                <div className="text-right"><div className={`font-bold ${pnlClass(item.raw)}`}>{money(item.raw)}</div><div className="text-xs text-zinc-400">{totalSymbolValue ? ((item.value / totalSymbolValue) * 100).toFixed(1) : "0.0"}%</div></div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl">
          <div className="flex items-center gap-3 mb-6"><div className="p-3 bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-xl"><Activity className="w-6 h-6 text-amber-400" /></div><div><h3 className="text-xl font-bold">Trading Activity</h3><p className="text-sm text-zinc-400">Monthly trade volume</p></div></div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyPL}><CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} /><XAxis dataKey="month" stroke="#9ca3af" /><YAxis stroke="#9ca3af" /><Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "12px" }} labelStyle={{ color: "#fff" }} /><Line type="monotone" dataKey="trades" stroke="#f59e0b" strokeWidth={3} dot={{ fill: "#f59e0b", r: 6 }} /></LineChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl">
          <div className="flex items-center gap-3 mb-6"><div className="p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl"><Award className="w-6 h-6 text-emerald-400" /></div><div><h3 className="text-xl font-bold">Win Rate Trend</h3><p className="text-sm text-zinc-400">Monthly win percentage</p></div></div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={winRateData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} /><XAxis dataKey="month" stroke="#9ca3af" /><YAxis stroke="#9ca3af" domain={[0, 100]} /><Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "12px" }} labelStyle={{ color: "#fff" }} /><Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={3} dot={{ fill: "#10b981", r: 6 }} /></LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="text-sm text-zinc-500">Loaded {trades.length} trades. Overall win rate: {summary.winRate.toFixed(1)}%.</div>
    </div>
  );
}
