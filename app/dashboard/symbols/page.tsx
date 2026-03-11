"use client";

import { useEffect, useMemo, useState } from "react";

type Timeframe = "7D" | "30D" | "1Y";

type ApiSymbolRow = {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  flat: number;
  win_rate: number;
  realized_pl: number;
  avg_win: number;
  avg_loss: number;
};

type SymbolsApiResponse = {
  ok: boolean;
  range: string;
  start_date: string;
  summary: {
    symbols: number;
    trades: number;
    realized_pl: number;
    win_rate: number;
  };
  rows: ApiSymbolRow[];
  error?: string;
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

function getRangeFromTimeframe(tf: Timeframe) {
  if (tf === "7D") return "7d";
  if (tf === "30D") return "30d";
  return "1y";
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

export default function SymbolsPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("30D");
  const [data, setData] = useState<SymbolsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const range = getRangeFromTimeframe(timeframe);

        const res = await fetch(`/api/symbols?range=${range}`, {
          cache: "no-store",
        });

        const json = (await res.json()) as SymbolsApiResponse;

        if (!res.ok || !json.ok) {
          throw new Error(
            json?.error || `Failed to load symbols analytics (${res.status})`,
          );
        }

        if (!cancelled) {
          setData(json);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to load symbols analytics.";
          setError(message);
          setData(null);
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

  const rows = data?.rows ?? [];

  const summary = useMemo(() => {
    const totalRealized = data?.summary?.realized_pl ?? 0;
    const totalTrades = data?.summary?.trades ?? 0;
    const totalSymbols = data?.summary?.symbols ?? 0;
    const overallWinRate = data?.summary?.win_rate ?? 0;

    const bestSymbol =
      rows.length > 0
        ? [...rows].sort((a, b) => b.realized_pl - a.realized_pl)[0]
        : null;

    const worstSymbol =
      rows.length > 0
        ? [...rows].sort((a, b) => a.realized_pl - b.realized_pl)[0]
        : null;

    const profitableSymbols = rows.filter((row) => row.realized_pl > 0).length;

    return {
      totalRealized,
      totalTrades,
      totalSymbols,
      overallWinRate,
      bestSymbol,
      worstSymbol,
      profitableSymbols,
    };
  }, [data, rows]);

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

        <div className="relative mx-auto w-full max-w-7xl px-6 pb-12 pt-8">
          <section className="rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
            <div className="border-b border-white/10 px-6 py-6 md:px-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                    Live Trade Analytics
                  </div>

                  <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                    Symbols
                  </h1>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/60 md:text-[15px]">
                    Ranked ticker performance from completed live trades only.
                    Live versus test can be compared side by side in Compare.
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/45">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      {timeframe} window
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      Live only
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      Completed live trades
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
                          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
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

            <div className="px-6 py-6 md:px-8">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.14] via-emerald-500/[0.04] to-transparent p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                        Realized P/L
                      </div>
                      <div
                        className={`mt-3 text-3xl font-semibold ${getPerformanceTone(
                          summary.totalRealized,
                        )}`}
                      >
                        {formatMoney(summary.totalRealized)}
                      </div>
                    </div>
                    <div
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getBadgeTone(
                        summary.totalRealized,
                      )}`}
                    >
                      {summary.totalRealized > 0
                        ? "Net positive"
                        : summary.totalRealized < 0
                          ? "Net negative"
                          : "Flat"}
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between text-sm text-white/50">
                    <span>{timeframe} aggregate</span>
                    <span>{summary.totalSymbols} symbols tracked</span>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                    Win Rate
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-white">
                    {formatPct(summary.overallWinRate)}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-sm text-white/50">
                    <span>Closed live trades only</span>
                    <span>{summary.totalTrades} total trades</span>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                    Best Symbol
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="text-3xl font-semibold text-white">
                      {summary.bestSymbol?.symbol || "—"}
                    </div>
                    {summary.bestSymbol ? (
                      <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                        Leader
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-sm text-white/50">
                    <span>
                      {summary.bestSymbol
                        ? formatMoney(summary.bestSymbol.realized_pl)
                        : "No data yet"}
                    </span>
                    <span>
                      {summary.bestSymbol
                        ? `${summary.bestSymbol.trades} live trade${summary.bestSymbol.trades === 1 ? "" : "s"}`
                        : "Awaiting live history"}
                    </span>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                    Desk Read
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-white">
                    {summary.profitableSymbols}/{summary.totalSymbols}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-sm text-white/50">
                    <span>Profitable tickers</span>
                    <span>
                      {summary.worstSymbol
                        ? `Worst: ${summary.worstSymbol.symbol}`
                        : "No laggard yet"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-white">
                      Ticker Breakdown
                    </h2>
                    <p className="mt-1 text-sm text-white/45">
                      Ranked by realized P/L from completed live trades only.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      Source: Completed live trades
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      Start: {data?.start_date ?? "—"}
                    </span>
                  </div>
                </div>

                {loading ? (
                  <div className="px-5 py-16">
                    <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center">
                      <div className="mb-4 h-10 w-10 animate-pulse rounded-full border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(52,211,153,0.18)]" />
                      <div className="text-base font-medium text-white">
                        Loading live symbol analytics
                      </div>
                      <div className="mt-2 text-sm text-white/45">
                        Pulling completed live-trade rankings for the selected
                        window.
                      </div>
                    </div>
                  </div>
                ) : error ? (
                  <div className="px-5 py-16">
                    <div className="mx-auto max-w-xl rounded-3xl border border-red-500/20 bg-red-500/8 p-6 text-center">
                      <div className="text-sm font-medium uppercase tracking-[0.2em] text-red-300">
                        Load Error
                      </div>
                      <div className="mt-3 text-base text-red-200">{error}</div>
                    </div>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="px-5 py-16">
                    <div className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl text-white/70">
                        ⌁
                      </div>
                      <h3 className="text-xl font-medium text-white">
                        No completed live trades yet
                      </h3>
                      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/50">
                        Symbols only ranks real completed trades. Once live
                        trades are ingested, this page will populate
                        automatically.
                      </p>
                      <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/50">
                        Compare is where live and test will sit side by side
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-white/[0.035] text-[11px] uppercase tracking-[0.18em] text-white/45">
                          <th className="px-5 py-4 text-left font-medium">#</th>
                          <th className="px-5 py-4 text-left font-medium">
                            Symbol
                          </th>
                          <th className="px-5 py-4 text-right font-medium">
                            Realized P/L
                          </th>
                          <th className="px-5 py-4 text-right font-medium">
                            Win Rate
                          </th>
                          <th className="px-5 py-4 text-right font-medium">
                            Trades
                          </th>
                          <th className="px-5 py-4 text-right font-medium">
                            Wins
                          </th>
                          <th className="px-5 py-4 text-right font-medium">
                            Losses
                          </th>
                          <th className="px-5 py-4 text-right font-medium">
                            Flat
                          </th>
                          <th className="px-5 py-4 text-right font-medium">
                            Avg Win
                          </th>
                          <th className="px-5 py-4 text-right font-medium">
                            Avg Loss
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => {
                          const rank = index + 1;
                          const rowTone =
                            row.realized_pl > 0
                              ? "from-emerald-500/[0.04]"
                              : row.realized_pl < 0
                                ? "from-red-500/[0.035]"
                                : "from-white/[0.02]";

                          return (
                            <tr
                              key={`${timeframe}-${row.symbol}`}
                              className={`border-t border-white/10 bg-gradient-to-r ${rowTone} to-transparent transition hover:bg-white/[0.03]`}
                            >
                              <td className="px-5 py-4 align-middle">
                                <div className="flex items-center">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-semibold text-white/75">
                                    {rank}
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-4 align-middle">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    {row.symbol.slice(0, 2)}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-white">
                                      {row.symbol}
                                    </div>
                                    <div className="mt-0.5 text-xs text-white/45">
                                      {row.trades} closed live trade
                                      {row.trades === 1 ? "" : "s"}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td
                                className={`px-5 py-4 text-right font-semibold ${getPerformanceTone(
                                  row.realized_pl,
                                )}`}
                              >
                                {formatMoney(row.realized_pl)}
                              </td>

                              <td className="px-5 py-4 text-right text-white">
                                {formatPct(row.win_rate)}
                              </td>

                              <td className="px-5 py-4 text-right text-white">
                                {row.trades}
                              </td>

                              <td className="px-5 py-4 text-right text-white">
                                {row.wins}
                              </td>

                              <td className="px-5 py-4 text-right text-white">
                                {row.losses}
                              </td>

                              <td className="px-5 py-4 text-right text-white/75">
                                {row.flat}
                              </td>

                              <td className="px-5 py-4 text-right text-emerald-400">
                                {formatMoney(row.avg_win)}
                              </td>

                              <td className="px-5 py-4 text-right text-red-400">
                                {formatMoney(row.avg_loss)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}