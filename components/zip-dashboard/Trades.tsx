"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { motion } from "motion/react";
import { Clock, Filter, Download, Plus, X } from "lucide-react";
import {
  avgTradeDuration,
  formatDateTime,
  loadSymbols,
  loadTrades,
  money,
  numberValue,
  pnlClass,
  saveManualTrade,
  sideLabel,
  signedMoney,
  summarizeTrades,
  type ManualTradeInput,
  type SymbolRow,
  type Trade,
} from "./data";

export default function Trades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError("");
        const [tradeRows, symbolData] = await Promise.all([
          loadTrades("all", 500, controller.signal, "live"),
          loadSymbols("1y", controller.signal, "live"),
        ]);
        setTrades(tradeRows);
        setSymbols(symbolData.rows);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load trades.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  async function reloadTrades() {
    const [tradeRows, symbolData] = await Promise.all([
      loadTrades("all", 500, undefined, "live"),
      loadSymbols("1y", undefined, "live"),
    ]);
    setTrades(tradeRows);
    setSymbols(symbolData.rows);
  }

  const summary = useMemo(() => summarizeTrades(trades), [trades]);
  const recentTrades = trades.slice(0, 50);
  const bestSymbolByPl = symbols[0]?.symbol ?? summary.best?.symbol ?? "-";
  const avgPnlPerTrade = trades.length ? summary.realized / trades.length : 0;

  if (loading) {
    return <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900 p-8 text-zinc-400">Loading real trade history...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">{error}</div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Trade History
          </h1>
          <p className="text-zinc-400">Complete record of your real closed trades</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-colors">
            <Filter className="w-4 h-4" />
            Live Only
          </button>
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Manual Trade
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700/50">
          <div className="text-sm text-zinc-400 mb-2">Total Trades</div>
          <div className="text-3xl font-bold text-white">{trades.length}</div>
          <div className="text-xs text-emerald-400 mt-1">{signedMoney(summary.realized)} realized</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700/50">
          <div className="text-sm text-zinc-400 mb-2">Win Rate</div>
          <div className="text-3xl font-bold text-emerald-400">{summary.winRate.toFixed(1)}%</div>
          <div className="text-xs text-zinc-400 mt-1">{summary.wins} winning trades</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700/50">
          <div className="text-sm text-zinc-400 mb-2">Avg P/L / Trade</div>
          <div className={`text-3xl font-bold ${pnlClass(avgPnlPerTrade)}`}>{signedMoney(avgPnlPerTrade)}</div>
          <div className="text-xs text-zinc-400 mt-1">{avgTradeDuration(trades)} avg hold</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700/50">
          <div className="text-sm text-zinc-400 mb-2">Best Trade</div>
          <div className="text-3xl font-bold text-emerald-400">{summary.best ? signedMoney(summary.best.realized_pl) : "-"}</div>
          <div className="text-xs text-zinc-400 mt-1">{summary.best?.symbol ?? bestSymbolByPl}</div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl">
            <Clock className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold">Recent Closed Trades</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left py-4 px-4 text-sm text-zinc-400 font-medium">Time</th>
                <th className="text-left py-4 px-4 text-sm text-zinc-400 font-medium">Symbol</th>
                <th className="text-left py-4 px-4 text-sm text-zinc-400 font-medium">Type</th>
                <th className="text-left py-4 px-4 text-sm text-zinc-400 font-medium">Qty</th>
                <th className="text-left py-4 px-4 text-sm text-zinc-400 font-medium">Entry</th>
                <th className="text-left py-4 px-4 text-sm text-zinc-400 font-medium">Exit</th>
                <th className="text-left py-4 px-4 text-sm text-zinc-400 font-medium">Best Ticker</th>
                <th className="text-left py-4 px-4 text-sm text-zinc-400 font-medium">P/L</th>
                <th className="text-left py-4 px-4 text-sm text-zinc-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade, idx) => {
                const side = sideLabel(trade.side);
                const pnl = numberValue(trade.realized_pl);
                return (
                  <motion.tr
                    key={String(trade.id ?? trade.external_trade_id ?? `${trade.symbol}-${idx}`)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.02 * idx }}
                    className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="py-5 px-4 text-zinc-400 text-sm">{formatDateTime(trade.closed_at ?? trade.trade_day)}</td>
                    <td className="py-5 px-4 font-bold text-lg">{trade.symbol ?? "-"}</td>
                    <td className="py-5 px-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${side === "CALL" || side === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-purple-500/20 text-purple-400"}`}>
                        {side}
                      </span>
                    </td>
                    <td className="py-5 px-4 text-zinc-300">{numberValue(trade.qty)}</td>
                    <td className="py-5 px-4 text-zinc-300">{money(trade.entry_price)}</td>
                    <td className="py-5 px-4 text-zinc-300">{money(trade.exit_price)}</td>
                    <td className="py-5 px-4 font-semibold text-cyan-400">{bestSymbolByPl}</td>
                    <td className={`py-5 px-4 font-bold text-lg ${pnlClass(pnl)}`}>{signedMoney(pnl)}</td>
                    <td className="py-5 px-4">
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-zinc-700 text-zinc-300">
                        {(trade.mode ?? "closed").toUpperCase()}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {manualOpen ? (
        <ManualTradeModal
          onClose={() => setManualOpen(false)}
          onSaved={async () => {
            await reloadTrades();
            setManualOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ManualTradeModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  const [form, setForm] = useState<ManualTradeInput>({
    symbol: "",
    side: "CALL",
    qty: 1,
    entry_price: 0,
    exit_price: 0,
    realized_pl: 0,
    opened_at: "",
    closed_at: localNow,
    mode: "live",
    strategy_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof ManualTradeInput>(key: K, value: ManualTradeInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      await saveManualTrade({
        ...form,
        symbol: form.symbol.trim().toUpperCase(),
        side: form.side.trim().toUpperCase(),
        strategy_name: form.strategy_name?.trim(),
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save manual trade.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl rounded-2xl border border-zinc-700/70 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 shadow-2xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Add Manual Trade</h2>
            <p className="mt-1 text-sm text-zinc-400">Use this when a trade was placed outside the bot.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-700 bg-zinc-800 p-2 text-zinc-400 transition hover:text-white"
            aria-label="Close manual trade form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Symbol">
              <input required value={form.symbol} onChange={(e) => update("symbol", e.target.value)} className="input" placeholder="SPY" />
            </Field>
            <Field label="Type / Side">
              <select value={form.side} onChange={(e) => update("side", e.target.value)} className="input">
                <option value="CALL">CALL</option>
                <option value="PUT">PUT</option>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </Field>
            <Field label="Mode">
              <select value={form.mode} onChange={(e) => update("mode", e.target.value as "live" | "paper")} className="input">
                <option value="live">Live</option>
                <option value="paper">Paper</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <NumberField label="Qty" value={form.qty} onChange={(value) => update("qty", value)} />
            <NumberField label="Entry" value={form.entry_price} onChange={(value) => update("entry_price", value)} step="0.0001" />
            <NumberField label="Exit" value={form.exit_price} onChange={(value) => update("exit_price", value)} step="0.0001" />
            <NumberField label="Realized P/L" value={form.realized_pl} onChange={(value) => update("realized_pl", value)} step="0.01" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Opened At">
              <input type="datetime-local" value={form.opened_at ?? ""} onChange={(e) => update("opened_at", e.target.value)} className="input" />
            </Field>
            <Field label="Closed At">
              <input required type="datetime-local" value={form.closed_at} onChange={(e) => update("closed_at", e.target.value)} className="input" />
            </Field>
            <Field label="Strategy">
              <input value={form.strategy_name ?? ""} onChange={(e) => update("strategy_name", e.target.value)} className="input" placeholder="Optional" />
            </Field>
          </div>

          {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-zinc-300 transition hover:bg-zinc-700 hover:text-white">
              Cancel
            </button>
            <button disabled={saving} type="submit" className="rounded-xl bg-emerald-500 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60">
              {saving ? "Saving..." : "Save Trade"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
}) {
  return (
    <Field label={label}>
      <input
        required
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input"
      />
    </Field>
  );
}
