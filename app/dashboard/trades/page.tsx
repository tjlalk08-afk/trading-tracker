"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type Range = "7D" | "30D" | "1Y" | "ALL";
type SourceFilter = "ALL" | "LIVE" | "TEST";

type TradeRow = {
  id?: string | number | null;
  snapshot_date?: string | null;
  trade_day?: string | null;
  symbol?: string | null;
  side?: string | null;
  qty?: number | string | null;
  entry_price?: number | string | null;
  exit_price?: number | string | null;
  realized_pl?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
  source?: string | null;
  external_trade_id?: string | null;
};

type TradeHistoryPayload = {
  ok: boolean;
  data?: TradeRow[];
  has_more?: boolean;
  next_cursor?: string | null;
  error?: string;
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

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function pnlTextClass(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (n > 0) return "text-emerald-300";
  if (n < 0) return "text-red-300";
  return "text-white";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function normalizeTradeSource(source: string | null | undefined): "LIVE" | "TEST" | "OTHER" {
  const s = String(source ?? "").trim().toLowerCase();
  if (!s) return "OTHER";
  if (s.includes("live") || s.includes("actual") || s.includes("real")) return "LIVE";
  if (s.includes("test") || s.includes("paper") || s.includes("shadow") || s.includes("sim")) {
    return "TEST";
  }
  return "OTHER";
}

function getRangeParam(range: Range) {
  if (range === "7D") return "7d";
  if (range === "30D") return "30d";
  if (range === "1Y") return "1y";
  return "all";
}

function getRangeLimit(range: Range) {
  return range === "ALL" ? 800 : 300;
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">{children}</div>;
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-2 text-xs font-medium transition",
        active
          ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-300"
          : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function TradesPage() {
  const [range, setRange] = useState<Range>("30D");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `/api/trade-history?range=${getRangeParam(range)}&limit=${getRangeLimit(range)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as TradeHistoryPayload;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load trade history.");
        }

        if (!cancelled) {
          setRows(json.data ?? []);
          setHasMore(Boolean(json.has_more));
          setNextCursor(json.next_cursor ?? null);
          setExpandedSymbol(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load trade history.");
          setRows([]);
          setHasMore(false);
          setNextCursor(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [range]);

  async function loadMoreTrades() {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError("");

    try {
      const res = await fetch(
        `/api/trade-history?range=${getRangeParam(range)}&limit=${getRangeLimit(range)}&before=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as TradeHistoryPayload;

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load more trades.");
      }

      setRows((current) => [...current, ...(json.data ?? [])]);
      setHasMore(Boolean(json.has_more));
      setNextCursor(json.next_cursor ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load more trades.");
    } finally {
      setLoadingMore(false);
    }
  }

  const filteredTrades = useMemo(() => {
    return rows.filter((row) => {
      if (sourceFilter === "ALL") return true;
      return normalizeTradeSource(row.source) === sourceFilter;
    });
  }, [rows, sourceFilter]);

  const tradeSummary = useMemo(() => {
    const realized = filteredTrades.map((row) => Number(row.realized_pl ?? 0));
    const wins = realized.filter((value) => value > 0).length;
    const losses = realized.filter((value) => value < 0).length;
    const flats = realized.filter((value) => value === 0).length;
    const net = realized.reduce((sum, value) => sum + value, 0);

    return {
      count: filteredTrades.length,
      wins,
      losses,
      flats,
      net,
      winRate: wins + losses ? (wins / (wins + losses)) * 100 : 0,
    };
  }, [filteredTrades]);

  const symbolRows = useMemo(() => {
    const bySymbol = new Map<
      string,
      {
        symbol: string;
        trades: TradeRow[];
        realized: number;
        wins: number;
        losses: number;
      }
    >();

    for (const trade of filteredTrades) {
      const symbol = String(trade.symbol ?? "").trim().toUpperCase();
      if (!symbol) continue;
      const realized = Number(trade.realized_pl ?? 0);

      if (!bySymbol.has(symbol)) {
        bySymbol.set(symbol, {
          symbol,
          trades: [],
          realized: 0,
          wins: 0,
          losses: 0,
        });
      }

      const bucket = bySymbol.get(symbol)!;
      bucket.trades.push(trade);
      bucket.realized += realized;
      if (realized > 0) bucket.wins += 1;
      if (realized < 0) bucket.losses += 1;
    }

    return Array.from(bySymbol.values())
      .map((bucket) => ({
        symbol: bucket.symbol,
        trades: bucket.trades.sort(
          (a, b) =>
            new Date(b.closed_at ?? b.trade_day ?? 0).getTime() -
            new Date(a.closed_at ?? a.trade_day ?? 0).getTime(),
        ),
        realized: bucket.realized,
        wins: bucket.wins,
        losses: bucket.losses,
        tradeCount: bucket.trades.length,
        winRate:
          bucket.wins + bucket.losses
            ? (bucket.wins / (bucket.wins + bucket.losses)) * 100
            : 0,
      }))
      .sort((a, b) => b.realized - a.realized);
  }, [filteredTrades]);

  const bestSymbol = symbolRows[0] ?? null;
  const worstSymbol = symbolRows.length ? [...symbolRows].sort((a, b) => a.realized - b.realized)[0] : null;

  return (
    <div className="relative isolate space-y-2 overflow-hidden pt-1">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.08),transparent_30%)]" />

      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tight text-white xl:text-4xl">Trades</h1>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
              Attribution + Ledger
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              {tradeSummary.count} loaded
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              {sourceFilter.toLowerCase()} source
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-wrap gap-2">
            {(["30D", "1Y", "ALL"] as Range[]).map((value) => (
              <FilterButton key={value} active={range === value} onClick={() => setRange(value)}>
                {value}
              </FilterButton>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/65">
            <span>Source</span>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
              className="bg-transparent text-white outline-none"
            >
              <option value="ALL" className="bg-[#0b1016] text-white">
                All
              </option>
              <option value="LIVE" className="bg-[#0b1016] text-white">
                Live
              </option>
              <option value="TEST" className="bg-[#0b1016] text-white">
                Test
              </option>
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <Surface className="border-red-400/20 bg-red-500/10 p-4">
          <div className="text-sm text-red-300">{error}</div>
        </Surface>
      ) : null}

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <Surface className="p-3.5">
          <SectionLabel>Net P/L</SectionLabel>
          <div className={`mt-2 text-[1.6rem] font-semibold ${pnlTextClass(tradeSummary.net)}`}>
            {signedMoney(tradeSummary.net)}
          </div>
          <div className="mt-1.5 text-sm text-white/55">Where the money landed in this range.</div>
        </Surface>
        <Surface className="p-3.5">
          <SectionLabel>Closed Trades</SectionLabel>
          <div className="mt-2 text-[1.6rem] font-semibold text-white">{tradeSummary.count}</div>
          <div className="mt-1.5 text-sm text-white/55">{sourceFilter} source filter</div>
        </Surface>
        <Surface className="p-3.5">
          <SectionLabel>Win Rate</SectionLabel>
          <div className={`mt-2 text-[1.6rem] font-semibold ${pnlTextClass(tradeSummary.net)}`}>
            {formatPct(tradeSummary.winRate)}
          </div>
          <div className="mt-1.5 text-sm text-white/55">
            {tradeSummary.wins} wins · {tradeSummary.losses} losses · {tradeSummary.flats} flat
          </div>
        </Surface>
        <Surface className="p-3.5">
          <SectionLabel>Best Symbol</SectionLabel>
          <div className="mt-2 text-[1.6rem] font-semibold text-white">{bestSymbol?.symbol ?? "--"}</div>
          <div className={`mt-1.5 text-sm ${pnlTextClass(bestSymbol?.realized ?? 0)}`}>
            {bestSymbol ? signedMoney(bestSymbol.realized) : "No trades"}
          </div>
        </Surface>
        <Surface className="p-3.5">
          <SectionLabel>Worst Symbol</SectionLabel>
          <div className="mt-2 text-[1.6rem] font-semibold text-white">{worstSymbol?.symbol ?? "--"}</div>
          <div className={`mt-1.5 text-sm ${pnlTextClass(worstSymbol?.realized ?? 0)}`}>
            {worstSymbol ? signedMoney(worstSymbol.realized) : "No trades"}
          </div>
        </Surface>
      </div>

      <Surface className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3.5">
          <SectionLabel>Money Attribution</SectionLabel>
          <div className="mt-1 text-[1.55rem] font-semibold text-white">Symbol Breakdown</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-white/60">Loading trade attribution...</div>
        ) : symbolRows.length === 0 ? (
          <div className="p-4 text-sm text-white/60">No closed trades found for this range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/45">
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium text-right">P/L</th>
                  <th className="px-4 py-3 font-medium text-right">Win Rate</th>
                  <th className="px-4 py-3 font-medium text-right">Trades</th>
                  <th className="px-4 py-3 font-medium text-right">Wins</th>
                  <th className="px-4 py-3 font-medium text-right">Losses</th>
                </tr>
              </thead>
              <tbody>
                {symbolRows.map((row) => (
                  <Fragment key={row.symbol}>
                    <tr className="border-b border-white/8 text-white/85">
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setExpandedSymbol((current) => (current === row.symbol ? null : row.symbol))}
                          className="text-left"
                        >
                          <div className="font-medium text-white">{row.symbol}</div>
                          <div className="mt-1 text-xs text-white/45">
                            {expandedSymbol === row.symbol ? "Hide trades" : "Show trades"}
                          </div>
                        </button>
                      </td>
                      <td className={`px-4 py-4 text-right font-medium ${pnlTextClass(row.realized)}`}>
                        {signedMoney(row.realized)}
                      </td>
                      <td className="px-4 py-4 text-right">{formatPct(row.winRate)}</td>
                      <td className="px-4 py-4 text-right">{row.tradeCount}</td>
                      <td className="px-4 py-4 text-right">{row.wins}</td>
                      <td className="px-4 py-4 text-right">{row.losses}</td>
                    </tr>
                    {expandedSymbol === row.symbol ? (
                      <tr className="border-b border-white/8 bg-black/20">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
                            <table className="min-w-full text-left text-sm">
                              <thead>
                                <tr className="border-b border-white/10 text-white/45">
                                  <th className="px-3 py-2.5 font-medium">Closed</th>
                                  <th className="px-3 py-2.5 font-medium">Side</th>
                                  <th className="px-3 py-2.5 font-medium text-right">Qty</th>
                                  <th className="px-3 py-2.5 font-medium text-right">Entry</th>
                                  <th className="px-3 py-2.5 font-medium text-right">Exit</th>
                                  <th className="px-3 py-2.5 font-medium text-right">P/L</th>
                                  <th className="px-3 py-2.5 font-medium">Source</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.trades.map((trade, index) => {
                                  const realized = Number(trade.realized_pl ?? 0);
                                  const source = normalizeTradeSource(trade.source);

                                  return (
                                    <tr
                                      key={String(trade.id ?? trade.external_trade_id ?? `${row.symbol}-${index}`)}
                                      className="border-b border-white/8 text-white/80 last:border-b-0"
                                    >
                                      <td className="px-3 py-2.5">{formatDate(trade.closed_at ?? trade.trade_day)}</td>
                                      <td className="px-3 py-2.5">{trade.side ?? "--"}</td>
                                      <td className="px-3 py-2.5 text-right">{Number(trade.qty ?? 0)}</td>
                                      <td className="px-3 py-2.5 text-right">{money(Number(trade.entry_price ?? 0))}</td>
                                      <td className="px-3 py-2.5 text-right">{money(Number(trade.exit_price ?? 0))}</td>
                                      <td className={`px-3 py-2.5 text-right font-medium ${pnlTextClass(realized)}`}>
                                        {signedMoney(realized)}
                                      </td>
                                      <td className="px-3 py-2.5">{source}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      <Surface className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3.5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <SectionLabel>Trade Ledger</SectionLabel>
              <div className="mt-1 text-[1.55rem] font-semibold text-white">Recent Closed Trades</div>
            </div>

            <button
              type="button"
              onClick={() => setLedgerOpen((current) => !current)}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/[0.08]"
            >
              {ledgerOpen ? "Hide Trade Ledger" : "Show Trade Ledger"}
            </button>
          </div>
        </div>

        {!ledgerOpen ? (
          <div className="px-4 py-5 text-sm text-white/55">Ledger hidden by default.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/45">
                    <th className="px-4 py-3 font-medium">Closed</th>
                    <th className="px-4 py-3 font-medium">Symbol</th>
                    <th className="px-4 py-3 font-medium">Side</th>
                    <th className="px-4 py-3 font-medium text-right">Qty</th>
                    <th className="px-4 py-3 font-medium text-right">Entry</th>
                    <th className="px-4 py-3 font-medium text-right">Exit</th>
                    <th className="px-4 py-3 font-medium text-right">Realized</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.length ? (
                    filteredTrades.map((trade, index) => {
                      const realized = Number(trade.realized_pl ?? 0);
                      const source = normalizeTradeSource(trade.source);
                      return (
                        <tr
                          key={String(trade.id ?? trade.external_trade_id ?? `${trade.symbol}-${index}`)}
                          className="border-b border-white/8 text-white/85 last:border-b-0"
                        >
                          <td className="px-4 py-4">{formatDate(trade.closed_at ?? trade.trade_day)}</td>
                          <td className="px-4 py-4 font-medium">{trade.symbol ?? "--"}</td>
                          <td className="px-4 py-4">{trade.side ?? "--"}</td>
                          <td className="px-4 py-4 text-right">{Number(trade.qty ?? 0)}</td>
                          <td className="px-4 py-4 text-right">{money(Number(trade.entry_price ?? 0))}</td>
                          <td className="px-4 py-4 text-right">{money(Number(trade.exit_price ?? 0))}</td>
                          <td className={`px-4 py-4 text-right font-medium ${pnlTextClass(realized)}`}>
                            {signedMoney(realized)}
                          </td>
                          <td className="px-4 py-4">{source}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-white/50">
                        No closed trades found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {hasMore ? (
              <div className="border-t border-white/10 px-4 py-3">
                <button
                  type="button"
                  onClick={() => void loadMoreTrades()}
                  disabled={loadingMore}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? "Loading More..." : "Load More Trades"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </Surface>
    </div>
  );
}
