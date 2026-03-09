"use client";

import { useEffect, useMemo, useState } from "react";

type Timeframe = "7D" | "30D" | "1Y";

type SymbolRow = {
  symbol: string;
  realizedPL: number;
  openPL: number;
  totalPL: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
};

function formatMoney(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function getDaysFromTimeframe(tf: Timeframe) {
  if (tf === "7D") return 7;
  if (tf === "30D") return 30;
  return 365;
}

export default function SymbolsPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("30D");
  const [rows, setRows] = useState<SymbolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const days = getDaysFromTimeframe(timeframe);

        // Replace this endpoint with your real one if different.
        // Expected response shape:
        // { rows: SymbolRow[] }
        const res = await fetch(`/api/analytics/symbols?days=${days}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Failed to load symbols analytics (${res.status})`);
        }

        const data = await res.json();

        if (!cancelled) {
          setRows(Array.isArray(data.rows) ? data.rows : []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load symbols analytics.");
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  const summary = useMemo(() => {
    const totalRealized = rows.reduce((sum, r) => sum + r.realizedPL, 0);
    const totalOpen = rows.reduce((sum, r) => sum + r.openPL, 0);
    const totalTrades = rows.reduce((sum, r) => sum + r.trades, 0);
    const totalWins = rows.reduce((sum, r) => sum + r.wins, 0);
    const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

    const bestSymbol =
      rows.length > 0
        ? [...rows].sort((a, b) => b.realizedPL - a.realizedPL)[0]
        : null;

    return {
      totalRealized,
      totalOpen,
      totalTrades,
      overallWinRate,
      bestSymbol,
    };
  }, [rows]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Symbols</h1>
            <p className="mt-2 text-sm text-white/60">
              Ticker performance by timeframe.
            </p>
          </div>

          <div className="inline-flex w-fit rounded-xl border border-white/10 bg-white/5 p-1">
            {(["7D", "30D", "1Y"] as Timeframe[]).map((tf) => {
              const active = timeframe === tf;
              return (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-emerald-500 text-black"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">
              Realized P/L
            </div>
            <div
              className={`mt-3 text-3xl font-semibold ${
                summary.totalRealized >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatMoney(summary.totalRealized)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">
              Open P/L
            </div>
            <div
              className={`mt-3 text-3xl font-semibold ${
                summary.totalOpen >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatMoney(summary.totalOpen)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">
              Win Rate
            </div>
            <div className="mt-3 text-3xl font-semibold text-white">
              {formatPct(summary.overallWinRate)}
            </div>
            <div className="mt-2 text-sm text-white/50">
              {summary.totalTrades} total trades
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">
              Best Symbol
            </div>
            <div className="mt-3 text-3xl font-semibold text-white">
              {summary.bestSymbol?.symbol || "—"}
            </div>
            <div className="mt-2 text-sm text-white/50">
              {summary.bestSymbol
                ? formatMoney(summary.bestSymbol.realizedPL)
                : "No data yet"}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-medium">Ticker Breakdown</h2>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-sm text-white/60">Loading symbols...</div>
          ) : error ? (
            <div className="px-5 py-10 text-sm text-red-400">{error}</div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-10 text-sm text-white/60">
              No symbol data available for this timeframe.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.03] text-left text-white/50">
                  <tr>
                    <th className="px-5 py-4 font-medium">Symbol</th>
                    <th className="px-5 py-4 font-medium">Realized P/L</th>
                    <th className="px-5 py-4 font-medium">Open P/L</th>
                    <th className="px-5 py-4 font-medium">Total P/L</th>
                    <th className="px-5 py-4 font-medium">Win Rate</th>
                    <th className="px-5 py-4 font-medium">Trades</th>
                    <th className="px-5 py-4 font-medium">Wins</th>
                    <th className="px-5 py-4 font-medium">Losses</th>
                    <th className="px-5 py-4 font-medium">Avg Win</th>
                    <th className="px-5 py-4 font-medium">Avg Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.symbol} className="border-t border-white/10">
                      <td className="px-5 py-4 font-medium text-white">{row.symbol}</td>
                      <td
                        className={`px-5 py-4 ${
                          row.realizedPL >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {formatMoney(row.realizedPL)}
                      </td>
                      <td
                        className={`px-5 py-4 ${
                          row.openPL >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {formatMoney(row.openPL)}
                      </td>
                      <td
                        className={`px-5 py-4 ${
                          row.totalPL >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {formatMoney(row.totalPL)}
                      </td>
                      <td className="px-5 py-4 text-white">{formatPct(row.winRate)}</td>
                      <td className="px-5 py-4 text-white">{row.trades}</td>
                      <td className="px-5 py-4 text-white">{row.wins}</td>
                      <td className="px-5 py-4 text-white">{row.losses}</td>
                      <td className="px-5 py-4 text-emerald-400">
                        {formatMoney(row.avgWin)}
                      </td>
                      <td className="px-5 py-4 text-red-400">
                        {formatMoney(row.avgLoss)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}