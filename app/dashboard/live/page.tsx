"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Position = {
  symbol?: string | null;
  display_symbol?: string | null;
  side?: string | null;
  qty?: number | string | null;
  entry_price?: number | string | null;
  mark?: number | string | null;
  open_pnl?: number | string | null;
  open_pl?: number | string | null;
  open_pnl_pct?: number | string | null;
  open_pl_pct?: number | string | null;
  option_symbol?: string | null;
};

type ClosedTrade = {
  qty?: number | string | null;
  side?: string | null;
  symbol?: string | null;
  display_symbol?: string | null;
  entry_price?: number | string | null;
  exit_price?: number | string | null;
  realized_pnl?: number | string | null;
  realized_pl?: number | string | null;
  option_symbol?: string | null;
  closed_at?: string | null;
  entry_time?: string | null;
  is_test?: boolean | null;
  trade_id?: string | null;
};

type DashboardData = {
  updated?: string | null;

  cash?: number | string | null;
  equity?: number | string | null;
  realized_pl?: number | string | null;
  open_pl?: number | string | null;
  total_pl?: number | string | null;

  live_cash?: number | string | null;
  live_equity?: number | string | null;
  live_realized_pl?: number | string | null;
  live_open_pl?: number | string | null;
  live_total_pl?: number | string | null;

  test_cash?: number | string | null;
  test_equity?: number | string | null;
  test_realized_pl?: number | string | null;
  test_open_pl?: number | string | null;
  test_total_pl?: number | string | null;

  positions?: Position[];
  closed_trades_live?: ClosedTrade[];
  closed_trades_test?: ClosedTrade[];
};

type DashboardResponse =
  | {
      ok?: boolean;
      data?: DashboardData;
      error?: string;
    }
  | DashboardData;

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown) {
  const n = toNumber(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function signedMoney(value: unknown) {
  const n = toNumber(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${money(n)}`;
}

function perfTone(value: unknown) {
  const n = toNumber(value);
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-white";
}

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCompactTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeDashboardPayload(json: DashboardResponse): DashboardData {
  if (
    typeof json === "object" &&
    json !== null &&
    "data" in json &&
    json.data &&
    typeof json.data === "object"
  ) {
    return json.data;
  }

  return (json as DashboardData) ?? {};
}

function StatCard({
  title,
  value,
  sub,
  tone = "text-white",
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
        {title}
      </div>
      <div className={`mt-3 text-3xl font-semibold ${tone}`}>{value}</div>
      {sub ? <div className="mt-3 text-sm text-white/50">{sub}</div> : null}
    </div>
  );
}

function CompactMetric({
  title,
  value,
  tone = "text-white",
}: {
  title: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
        {title}
      </div>
      <div className={`mt-1.5 text-lg font-semibold xl:text-xl ${tone}`}>
        {value}
      </div>
    </div>
  );
}

function SectionShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-white/45">{subtitle}</p>
          ) : null}
        </div>
        {right ? (
          <div className="flex flex-wrap items-center gap-2">{right}</div>
        ) : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function TradeCard({
  row,
  mode,
}: {
  row: ClosedTrade;
  mode: "live" | "test";
}) {
  const realized = toNumber(row.realized_pnl ?? row.realized_pl);
  const symbol = row.display_symbol ?? row.symbol ?? "—";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-white">
            {symbol.slice(0, 2).toUpperCase()}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-white">{symbol}</div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/65">
                {row.side ?? "—"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/65">
                Qty {toNumber(row.qty)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/65">
                {mode}
              </span>
            </div>

            <div className="mt-1 text-sm text-white/45">
              Closed {formatCompactTime(row.closed_at)}
            </div>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Realized
          </div>
          <div className={`mt-1 text-xl font-semibold ${perfTone(realized)}`}>
            {signedMoney(realized)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
            Entry
          </div>
          <div className="mt-1 text-sm font-medium text-white">
            {money(row.entry_price)}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
            Exit
          </div>
          <div className="mt-1 text-sm font-medium text-white">
            {money(row.exit_price)}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 md:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
            Option Symbol
          </div>
          <div className="mt-1 break-all text-sm font-medium text-white/75">
            {row.option_symbol ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LivePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/bot/dashboard", {
          cache: "no-store",
        });

        const json: DashboardResponse = await res.json();

        if (!res.ok) {
          const message =
            typeof json === "object" &&
            json !== null &&
            "error" in json &&
            typeof json.error === "string"
              ? json.error
              : "Failed to load live dashboard";
          throw new Error(message);
        }

        if (!cancelled) {
          setData(normalizeDashboardPayload(json));
          setError("");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load live dashboard";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    const interval = setInterval(load, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const positions = useMemo(
    () => (Array.isArray(data?.positions) ? data.positions : []),
    [data],
  );

  const closedLive = useMemo(() => {
    const rows = Array.isArray(data?.closed_trades_live)
      ? [...data.closed_trades_live]
      : [];
    rows.sort(
      (a, b) =>
        new Date(b.closed_at ?? 0).getTime() -
        new Date(a.closed_at ?? 0).getTime(),
    );
    return rows;
  }, [data]);

  const closedTest = useMemo(() => {
    const rows = Array.isArray(data?.closed_trades_test)
      ? [...data.closed_trades_test]
      : [];
    rows.sort(
      (a, b) =>
        new Date(b.closed_at ?? 0).getTime() -
        new Date(a.closed_at ?? 0).getTime(),
    );
    return rows;
  }, [data]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-16">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center">
            <div className="mb-4 h-10 w-10 animate-pulse rounded-full border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(52,211,153,0.18)]" />
            <div className="text-base font-medium text-white">
              Loading live monitor
            </div>
            <div className="mt-2 text-sm text-white/45">
              Pulling the brother dashboard and opening the live feed.
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                    Live Monitor
                  </div>

                  <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                    Live
                  </h1>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/60 md:text-[15px]">
                    Polls the brother dashboard every second while this page is
                    open, including current positions and recently closed trades.
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/45">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      Polling every 1 second
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      Last poll: {formatTimestamp(data?.updated)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      {closedLive.length} live closed · {closedTest.length} test
                      closed
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6 md:px-8">
              {error ? (
                <div className="mb-6 rounded-3xl border border-red-500/20 bg-red-500/8 p-6 text-center">
                  <div className="text-sm font-medium uppercase tracking-[0.2em] text-red-300">
                    Live Feed Error
                  </div>
                  <div className="mt-3 text-base text-red-200">{error}</div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-5">
                <StatCard title="Cash" value={money(data?.cash)} />
                <StatCard title="Equity" value={money(data?.equity)} />
                <StatCard
                  title="Realized P/L"
                  value={signedMoney(data?.realized_pl)}
                  tone={perfTone(data?.realized_pl)}
                />
                <StatCard
                  title="Open P/L"
                  value={signedMoney(data?.open_pl)}
                  tone={perfTone(data?.open_pl)}
                />
                <StatCard
                  title="Total P/L"
                  value={signedMoney(data?.total_pl)}
                  tone={perfTone(data?.total_pl)}
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionShell
                  title="Live Account"
                  subtitle="Current live account metrics."
                  right={
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/45">
                      {closedLive.length} closed trades
                    </span>
                  }
                >
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <CompactMetric title="Cash" value={money(data?.live_cash)} />
                    <CompactMetric
                      title="Equity"
                      value={money(data?.live_equity)}
                    />
                    <CompactMetric
                      title="Realized"
                      value={signedMoney(data?.live_realized_pl)}
                      tone={perfTone(data?.live_realized_pl)}
                    />
                    <CompactMetric
                      title="Open"
                      value={signedMoney(data?.live_open_pl)}
                      tone={perfTone(data?.live_open_pl)}
                    />
                    <CompactMetric
                      title="Total"
                      value={signedMoney(data?.live_total_pl)}
                      tone={perfTone(data?.live_total_pl)}
                    />
                  </div>
                </SectionShell>

                <SectionShell
                  title="Test Account"
                  subtitle="Current shadow account metrics."
                  right={
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/45">
                      {closedTest.length} closed trades
                    </span>
                  }
                >
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <CompactMetric title="Cash" value={money(data?.test_cash)} />
                    <CompactMetric
                      title="Equity"
                      value={money(data?.test_equity)}
                    />
                    <CompactMetric
                      title="Realized"
                      value={signedMoney(data?.test_realized_pl)}
                      tone={perfTone(data?.test_realized_pl)}
                    />
                    <CompactMetric
                      title="Open"
                      value={signedMoney(data?.test_open_pl)}
                      tone={perfTone(data?.test_open_pl)}
                    />
                    <CompactMetric
                      title="Total"
                      value={signedMoney(data?.test_total_pl)}
                      tone={perfTone(data?.test_total_pl)}
                    />
                  </div>
                </SectionShell>
              </div>

              <div className="mt-6">
                <SectionShell
                  title="Open Positions"
                  subtitle="Currently open positions from the live feed."
                  right={
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/45">
                      {positions.length} open
                    </span>
                  }
                >
                  {positions.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/55">
                      No open positions right now.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {positions.map((row, idx) => {
                        const openPl = toNumber(row.open_pnl ?? row.open_pl);
                        const openPct = toNumber(
                          row.open_pnl_pct ?? row.open_pl_pct,
                        );

                        return (
                          <div
                            key={`${
                              row.option_symbol ?? row.symbol ?? "pos"
                            }-${idx}`}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-white">
                                  {(row.display_symbol ?? row.symbol ?? "—")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </div>

                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-lg font-semibold text-white">
                                      {row.display_symbol ?? row.symbol ?? "—"}
                                    </div>
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/65">
                                      {row.side ?? "—"}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/65">
                                      Qty {toNumber(row.qty)}
                                    </span>
                                  </div>

                                  <div className="mt-1 break-all text-sm text-white/45">
                                    {row.option_symbol ?? "—"}
                                  </div>
                                </div>
                              </div>

                              <div className="text-left sm:text-right">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                                  Open P/L
                                </div>
                                <div
                                  className={`mt-1 text-xl font-semibold ${perfTone(
                                    openPl,
                                  )}`}
                                >
                                  {signedMoney(openPl)}
                                </div>
                                <div
                                  className={`mt-1 text-sm ${perfTone(openPct)}`}
                                >
                                  {`${openPct > 0 ? "+" : ""}${openPct.toFixed(
                                    2,
                                  )}%`}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                                <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                                  Entry
                                </div>
                                <div className="mt-1 text-sm font-medium text-white">
                                  {money(row.entry_price)}
                                </div>
                              </div>

                              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                                <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                                  Mark
                                </div>
                                <div className="mt-1 text-sm font-medium text-white">
                                  {money(row.mark)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionShell>
              </div>

              <div className="mt-6 space-y-4">
                <SectionShell
                  title="Completed Live Trades"
                  subtitle="Recently closed live trades from the bot feed."
                  right={
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/45">
                      {closedLive.length} live closed
                    </span>
                  }
                >
                  {closedLive.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/55">
                      No completed live trades yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {closedLive.map((row, idx) => (
                        <TradeCard
                          key={
                            row.trade_id ??
                            `${row.option_symbol ?? row.symbol ?? "live"}-${idx}`
                          }
                          row={row}
                          mode="live"
                        />
                      ))}
                    </div>
                  )}
                </SectionShell>

                <SectionShell
                  title="Completed Test Trades"
                  subtitle="Recently closed shadow trades from the bot feed."
                  right={
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/45">
                      {closedTest.length} test closed
                    </span>
                  }
                >
                  {closedTest.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/55">
                      No completed test trades yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {closedTest.map((row, idx) => (
                        <TradeCard
                          key={
                            row.trade_id ??
                            `${row.option_symbol ?? row.symbol ?? "test"}-${idx}`
                          }
                          row={row}
                          mode="test"
                        />
                      ))}
                    </div>
                  )}
                </SectionShell>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}