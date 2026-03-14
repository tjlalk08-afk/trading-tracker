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
  return "text-slate-100";
}

function getBadgeTone(value: number) {
  if (value > 0) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
  if (value < 0) {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }
  return "border-slate-700/40 bg-slate-800/70 text-slate-300";
}

function StatShell({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        accent
          ? "border-slate-700/40 bg-[linear-gradient(135deg,rgba(60,163,123,0.14),rgba(22,31,43,0.96)_34%,rgba(12,18,27,0.98))]"
          : "border-slate-700/40 bg-[linear-gradient(180deg,rgba(22,31,43,0.88),rgba(15,23,33,0.98))]",
      ].join(" ")}
    >
      {children}
    </div>
  );
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

  const rows = useMemo(() => data?.rows ?? [], [data]);

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
    <div className="text-slate-100">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-[rgba(60,163,123,0.08)] blur-[140px]" />
          <div className="absolute left-[-10%] top-[18%] h-[320px] w-[320px] rounded-full bg-[rgba(71,85,105,0.18)] blur-[120px]" />
          <div className="absolute right-[-10%] top-[8%] h-[320px] w-[320px] rounded-full bg-[rgba(30,41,59,0.22)] blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              maskImage:
                "linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0.25) 70%, rgba(0,0,0,0))",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-[1880px] px-3 pb-4 pt-2 sm:px-4 xl:px-5">
          <section className="rounded-[24px] border border-slate-700/40 bg-[linear-gradient(180deg,rgba(22,31,43,0.96),rgba(12,18,27,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.38)] backdrop-blur-sm">
            <div className="border-b border-slate-700/40 px-3 py-3 sm:px-4 xl:px-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[rgba(60,163,123,0.24)] bg-[rgba(60,163,123,0.08)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                    Symbol Governance
                  </div>

                  <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[1.9rem] xl:text-[2.2rem]">
                    Symbols
                  </h1>

                  <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-slate-400 sm:text-sm">
                    Rank active tickers, audit recent profitability, and spot
                    deterioration before a symbol starts dragging the desk.
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 sm:text-[11px]">
                    <span className="rounded-full border border-slate-700/40 bg-slate-900/45 px-3 py-1.5">
                      {timeframe} window
                    </span>
                    <span className="rounded-full border border-slate-700/40 bg-slate-900/45 px-3 py-1.5">
                      Live completed trades
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700/40 bg-slate-950/55 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-1">
                    {(["7D", "30D", "1Y"] as Timeframe[]).map((tf) => {
                      const active = timeframe === tf;
                      return (
                        <button
                          key={tf}
                          onClick={() => setTimeframe(tf)}
                          className={`rounded-xl px-3 py-1.5 text-[13px] font-medium transition ${
                            active
                              ? "bg-[rgba(60,163,123,0.14)] text-[var(--accent-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                              : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
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

            <div className="px-3 py-3 sm:px-4 xl:px-5">
              <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-4">
                <StatShell accent>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Realized P/L
                      </div>
                      <div
                        className={`mt-1.5 text-[1.25rem] font-semibold sm:text-[1.45rem] ${getPerformanceTone(
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
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 sm:text-xs">
                    <span>{timeframe} aggregate</span>
                    <span>{summary.totalSymbols} symbols tracked</span>
                  </div>
                </StatShell>

                <StatShell>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    Win Rate
                  </div>
                  <div className="font-mono-metric mt-1.5 text-[1.2rem] font-semibold text-slate-100 sm:text-[1.35rem]">
                    {formatPct(summary.overallWinRate)}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 sm:text-xs">
                    <span>Closed live trades only</span>
                    <span>{summary.totalTrades} total trades</span>
                  </div>
                </StatShell>

                <StatShell>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    Best Symbol
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="text-[1.2rem] font-semibold text-slate-100 sm:text-[1.35rem]">
                      {summary.bestSymbol?.symbol || "—"}
                    </div>
                    {summary.bestSymbol ? (
                      <div className="rounded-full border border-[rgba(60,163,123,0.24)] bg-[rgba(60,163,123,0.08)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-strong)]">
                        Leader
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 sm:text-xs">
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
                </StatShell>

                <StatShell>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    Desk Read
                  </div>
                  <div className="font-mono-metric mt-1.5 text-[1.2rem] font-semibold text-slate-100 sm:text-[1.35rem]">
                    {summary.profitableSymbols}/{summary.totalSymbols}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 sm:text-xs">
                    <span>Profitable tickers</span>
                    <span>
                      {summary.worstSymbol
                        ? `Worst: ${summary.worstSymbol.symbol}`
                        : "No laggard yet"}
                    </span>
                  </div>
                </StatShell>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Start Date
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-200">
                    {data?.start_date ?? "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Total Trades
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-200">
                    {summary.totalTrades}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Worst Symbol
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-200">
                    {summary.worstSymbol?.symbol || "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Desk Status
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-200">
                    {summary.profitableSymbols === summary.totalSymbols ? "Healthy" : "Mixed"}
                  </div>
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-[24px] border border-slate-700/40 bg-slate-950/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex flex-col gap-2 border-b border-slate-700/40 px-3 py-3 sm:px-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-base font-medium text-slate-100">
                      Ticker Breakdown
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Ranked by realized P/L from completed live trades only.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-slate-700/40 bg-slate-900/45 px-3 py-1.5">
                      Start: {data?.start_date ?? "—"}
                    </span>
                  </div>
                </div>

                {loading ? (
                  <div className="px-4 py-12 sm:px-5">
                    <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center">
                      <div className="mb-4 h-10 w-10 animate-pulse rounded-full border border-[rgba(60,163,123,0.24)] bg-[rgba(60,163,123,0.08)]" />
                      <div className="text-base font-medium text-slate-100">
                        Loading live symbol analytics
                      </div>
                      <div className="mt-2 text-sm text-slate-400">
                        Pulling completed live-trade rankings for the selected
                        window.
                      </div>
                    </div>
                  </div>
                ) : error ? (
                  <div className="px-4 py-12 sm:px-5">
                    <div className="mx-auto max-w-xl rounded-3xl border border-red-500/20 bg-red-500/8 p-5 text-center">
                      <div className="text-sm font-medium uppercase tracking-[0.2em] text-red-300">
                        Load Error
                      </div>
                      <div className="mt-3 text-base text-red-200">{error}</div>
                    </div>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="px-4 py-12 sm:px-5">
                    <div className="mx-auto max-w-2xl rounded-[24px] border border-slate-700/40 bg-[linear-gradient(180deg,rgba(22,31,43,0.88),rgba(15,23,33,0.98))] p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/40 bg-slate-900/45 text-xl text-slate-300">
                        +
                      </div>
                      <h3 className="text-xl font-medium text-slate-100">
                        No completed live trades yet
                      </h3>
                      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
                        Symbols only ranks real completed trades. Once live
                        trades are ingested, this page will populate
                        automatically.
                      </p>
                      <div className="mt-5 inline-flex rounded-full border border-slate-700/40 bg-slate-900/45 px-4 py-2 text-xs text-slate-400">
                        Compare is where live and test will sit side by side
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-slate-900/70 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          <th className="px-3 py-2.5 text-left font-medium">#</th>
                          <th className="px-3 py-2.5 text-left font-medium">
                            Symbol
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Realized P/L
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Win Rate
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Trades
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Wins
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Losses
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Flat
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Avg Win
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Avg Loss
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => {
                          const rank = index + 1;
                          const rowTone =
                            row.realized_pl > 0
                              ? "from-emerald-500/[0.045]"
                              : row.realized_pl < 0
                                ? "from-red-500/[0.04]"
                                : "from-slate-800/50";

                          return (
                            <tr
                              key={`${timeframe}-${row.symbol}`}
                              className={`border-t border-slate-700/30 bg-gradient-to-r ${rowTone} to-transparent transition hover:bg-slate-900/38`}
                            >
                              <td className="px-3 py-2.5 align-middle">
                                <div className="flex items-center">
                                  <div className="font-mono-metric flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/40 bg-slate-900/50 text-xs font-semibold text-slate-300">
                                    {rank}
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-2.5 align-middle">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700/40 bg-slate-900/55 text-sm font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    {row.symbol.slice(0, 2)}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-100">
                                      {row.symbol}
                                    </div>
                                    <div className="mt-0.5 text-xs text-slate-400">
                                      {row.trades} closed live trade
                                      {row.trades === 1 ? "" : "s"}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td
                                className={`font-mono-metric px-3 py-2.5 text-right font-semibold ${getPerformanceTone(
                                  row.realized_pl,
                                )}`}
                              >
                                {formatMoney(row.realized_pl)}
                              </td>

                              <td className="font-mono-metric px-3 py-2.5 text-right text-slate-100">
                                {formatPct(row.win_rate)}
                              </td>

                              <td className="font-mono-metric px-3 py-2.5 text-right text-slate-100">
                                {row.trades}
                              </td>

                              <td className="font-mono-metric px-3 py-2.5 text-right text-slate-100">
                                {row.wins}
                              </td>

                              <td className="font-mono-metric px-3 py-2.5 text-right text-slate-100">
                                {row.losses}
                              </td>

                              <td className="font-mono-metric px-3 py-2.5 text-right text-slate-300">
                                {row.flat}
                              </td>

                              <td className="font-mono-metric px-3 py-2.5 text-right text-emerald-400">
                                {formatMoney(row.avg_win)}
                              </td>

                              <td className="font-mono-metric px-3 py-2.5 text-right text-red-400">
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
