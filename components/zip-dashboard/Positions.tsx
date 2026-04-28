"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Zap, TestTube } from "lucide-react";
import { formatDateTime, loadEvents, loadLatest, loadTrades, money, numberValue, pnlClass, sideLabel, signedMoney, type Snapshot, type Trade, type TradeEvent } from "./data";

export default function Positions() {
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<TradeEvent[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        const [latestData, eventRows, tradeRows] = await Promise.all([
          loadLatest(controller.signal),
          loadEvents(80, controller.signal, "all"),
          loadTrades("30d", 100, controller.signal, "live"),
        ]);
        setLatest(latestData);
        setEvents(eventRows);
        setTrades(tradeRows);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load positions.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const liveEvents = events.filter((event) => event.mode === "live").slice(0, 8);
  const testEvents = events.filter((event) => event.mode !== "live" || event.is_test).slice(0, 8);
  const completedToday = trades.slice(0, 8);

  if (loading) return <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900 p-8 text-zinc-400">Loading real position activity...</div>;
  if (error) return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">{error}</div>;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">Live Positions</h1>
          <p className="text-zinc-400">Real-time position and trade event monitoring</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right"><div className="text-sm text-zinc-400">Live P/L</div><div className={`text-3xl font-bold ${pnlClass(latest?.live_total_pl ?? latest?.total_pl)}`}>{signedMoney(latest?.live_total_pl ?? latest?.total_pl)}</div></div>
          <div className="text-right"><div className="text-sm text-zinc-400">Test P/L</div><div className={`text-3xl font-bold ${pnlClass(latest?.test_total_pl, "text-blue-400")}`}>{signedMoney(latest?.test_total_pl)}</div></div>
        </div>
      </div>

      <EventPanel title="Live Trade Events" subtitle={`${liveEvents.length} recent live events`} events={liveEvents} icon="live" />
      <EventPanel title="Test Trade Events" subtitle={`${testEvents.length} recent test/paper events`} events={testEvents} icon="test" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div><h3 className="text-2xl font-bold">Completed Recently</h3><p className="text-sm text-zinc-400">Real closed positions from trade history</p></div>
          <div className="text-right"><div className="text-sm text-zinc-400">Loaded P/L</div><div className={`text-2xl font-bold ${pnlClass(completedToday.reduce((sum, trade) => sum + numberValue(trade.realized_pl), 0))}`}>{signedMoney(completedToday.reduce((sum, trade) => sum + numberValue(trade.realized_pl), 0))}</div></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-zinc-700">{["Time", "Symbol", "Type", "Qty", "Entry", "Exit", "P/L", "Mode"].map((head) => <th key={head} className="text-left py-4 px-4 text-sm text-zinc-400 font-medium">{head}</th>)}</tr></thead>
            <tbody>
              {completedToday.map((trade, idx) => {
                const pnl = numberValue(trade.realized_pl);
                const side = sideLabel(trade.side);
                return (
                  <motion.tr key={String(trade.id ?? idx)} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * idx }} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                    <td className="py-5 px-4 text-zinc-400">{formatDateTime(trade.closed_at ?? trade.trade_day)}</td>
                    <td className="py-5 px-4 font-bold text-lg">{trade.symbol}</td>
                    <td className="py-5 px-4"><span className={`px-3 py-1 rounded-lg text-xs font-semibold ${side === "CALL" || side === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-purple-500/20 text-purple-400"}`}>{side}</span></td>
                    <td className="py-5 px-4 text-zinc-300">{numberValue(trade.qty)}</td>
                    <td className="py-5 px-4 text-zinc-300">{money(trade.entry_price)}</td>
                    <td className="py-5 px-4 text-zinc-300">{money(trade.exit_price)}</td>
                    <td className={`py-5 px-4 font-bold text-lg ${pnlClass(pnl)}`}>{signedMoney(pnl)}</td>
                    <td className="py-5 px-4 font-semibold text-zinc-300">{(trade.mode ?? "-").toUpperCase()}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function EventPanel({ title, subtitle, events, icon }: { title: string; subtitle: string; events: TradeEvent[]; icon: "live" | "test" }) {
  const Icon = icon === "live" ? Zap : TestTube;
  const tone = icon === "live" ? "from-emerald-500/20 to-emerald-600/10 text-emerald-400" : "from-blue-500/20 to-blue-600/10 text-blue-400";
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl">
      <div className="flex items-center gap-3 mb-6"><div className={`p-3 bg-gradient-to-br ${tone.split(" ").slice(0, 2).join(" ")} rounded-xl`}><Icon className={`w-6 h-6 ${tone.split(" ").slice(2).join(" ")}`} /></div><div><h3 className="text-2xl font-bold">{title}</h3><p className="text-sm text-zinc-400">{subtitle}</p></div></div>
      <div className="space-y-3">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 text-sm text-zinc-400 font-medium border-b border-zinc-700"><div>Symbol</div><div>Event</div><div>Side</div><div>Mode</div><div>Source</div><div>Time</div></div>
        {events.map((event) => (
          <div key={event.id} className={`grid grid-cols-6 gap-4 p-4 rounded-xl border ${icon === "test" ? "bg-blue-500/5 border-blue-500/30 hover:bg-blue-500/10" : "bg-zinc-800/30 border-zinc-700/50 hover:bg-zinc-800/50"} transition-colors`}>
            <div className="font-bold text-lg">{event.symbol}</div><div className="text-zinc-300">{event.event_type}</div><div className="text-zinc-300">{event.side ?? "-"}</div><div className="font-semibold text-cyan-400">{event.mode}</div><div className="text-zinc-300">{event.source}</div><div className="text-zinc-400">{formatDateTime(event.event_time_utc)}</div>
          </div>
        ))}
        {!events.length ? <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4 text-zinc-400">No recent events found.</div> : null}
      </div>
    </motion.div>
  );
}
