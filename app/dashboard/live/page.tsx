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
  mode?: string | null;
  updated?: string | null;
  cash?: number | string | null;
  equity?: number | string | null;
  realized_pl?: number | string | null;
  open_pl?: number | string | null;
  total_pl?: number | string | null;
  live_cash?: number | string | null;
  live_equity?: number | string | null;
  live_realized_pl?: number | string | null;
  live_realized_pnl?: number | string | null;
  live_open_pl?: number | string | null;
  live_open_pnl?: number | string | null;
  live_total_pl?: number | string | null;
  live_total_pnl?: number | string | null;
  test_cash?: number | string | null;
  test_equity?: number | string | null;
  test_realized_pl?: number | string | null;
  test_realized_pnl?: number | string | null;
  test_open_pl?: number | string | null;
  test_open_pnl?: number | string | null;
  test_total_pl?: number | string | null;
  test_total_pnl?: number | string | null;
  positions?: Position[];
  live_positions?: Position[] | Record<string, Position>;
  positions_live?: Position[] | Record<string, Position>;
  test_positions?: Position[] | Record<string, Position>;
  positions_test?: Position[] | Record<string, Position>;
  closed_trades_live?: ClosedTrade[];
  live_closed_trades?: ClosedTrade[];
  closed_trades_test?: ClosedTrade[];
  test_closed_trades?: ClosedTrade[];
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
  const payload =
    typeof json === "object" &&
    json !== null &&
    "data" in json &&
    json.data &&
    typeof json.data === "object"
      ? (json.data as DashboardData)
      : ((json as DashboardData) ?? {});

  const liveRealized =
    payload.live_realized_pl ?? payload.live_realized_pnl ?? payload.realized_pl;
  const liveOpen = payload.live_open_pl ?? payload.live_open_pnl ?? payload.open_pl;
  const liveTotal = payload.live_total_pl ?? payload.live_total_pnl ?? payload.total_pl;
  const testRealized = payload.test_realized_pl ?? payload.test_realized_pnl ?? 0;
  const testOpen = payload.test_open_pl ?? payload.test_open_pnl ?? 0;
  const testTotal = payload.test_total_pl ?? payload.test_total_pnl ?? 0;

  return {
    ...payload,
    live_realized_pl: liveRealized,
    live_open_pl: liveOpen,
    live_total_pl: liveTotal,
    test_realized_pl: testRealized,
    test_open_pl: testOpen,
    test_total_pl: testTotal,
    realized_pl: payload.realized_pl ?? liveRealized,
    open_pl: payload.open_pl ?? liveOpen,
    total_pl: payload.total_pl ?? liveTotal,
  };
}

function asPositionArray(value: unknown): Position[] {
  if (Array.isArray(value)) return value;

  if (typeof value === "object" && value !== null) {
    return Object.values(value).filter(
      (row): row is Position => typeof row === "object" && row !== null,
    );
  }

  return [];
}

function asTradeArray(value: unknown): ClosedTrade[] {
  return Array.isArray(value) ? value : [];
}

function livePositionsFromPayload(data: DashboardData | null): Position[] {
  if (!data) return [];

  const positions = asPositionArray(data.positions);
  if (positions.length > 0) return positions;

  const explicitLive = asPositionArray(data.live_positions);
  if (explicitLive.length > 0) return explicitLive;

  return asPositionArray(data.positions_live);
}

function closedLiveTradesFromPayload(data: DashboardData | null): ClosedTrade[] {
  if (!data) return [];

  const primary = asTradeArray(data.closed_trades_live);
  if (primary.length > 0) return primary;

  return asTradeArray(data.live_closed_trades);
}

function closedTestTradesFromPayload(data: DashboardData | null): ClosedTrade[] {
  if (!data) return [];

  const primary = asTradeArray(data.closed_trades_test);
  if (primary.length > 0) return primary;

  return asTradeArray(data.test_closed_trades);
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
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">{title}</div>
      <div className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</div>
      {sub ? <div className="mt-1.5 text-xs text-white/50">{sub}</div> : null}
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
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">{title}</div>
      <div className={`mt-1 text-base font-semibold ${tone}`}>{value}</div>
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
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white sm:text-xl">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-white/45">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      <div className="px-4 py-3">{children}</div>
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-white">
            {symbol.slice(0, 2).toUpperCase()}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-base font-semibold text-white">{symbol}</div>
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

            <div className="mt-1 text-sm text-white/45">Closed {formatCompactTime(row.closed_at)}</div>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Realized</div>
          <div className={`mt-1 text-lg font-semibold ${perfTone(realized)}`}>{signedMoney(realized)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Entry</div>
          <div className="mt-1 text-sm font-medium text-white">{money(row.entry_price)}</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Exit</div>
          <div className="mt-1 text-sm font-medium text-white">{money(row.exit_price)}</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 md:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Option Symbol</div>
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
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    function publishPollStatus(detail: { ok: boolean; ts: string; error?: string }) {
      window.dispatchEvent(
        new CustomEvent("dashboard-live-poll", {
          detail,
        }),
      );
    }

    async function load() {
      controller?.abort();
      controller = new AbortController();

      try {
        const res = await fetch("/api/bot/dashboard", {
          cache: "no-store",
          signal: controller.signal,
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
          publishPollStatus({ ok: true, ts: new Date().toISOString() });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load live dashboard";
          setError(message);
          publishPollStatus({
            ok: false,
            ts: new Date().toISOString(),
            error: message,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }

        if (!cancelled) {
          timeoutId = setTimeout(() => {
            void load();
          }, 3000);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller?.abort();
      if (timeoutId) clearTimeout(timeoutId);
      publishPollStatus({ ok: false, ts: new Date().toISOString(), error: "stopped" });
    };
  }, []);

  const positions = useMemo(() => livePositionsFromPayload(data), [data]);

  const closedLive = useMemo(() => {
    const rows = [...closedLiveTradesFromPayload(data)];
    rows.sort(
      (a, b) =>
        new Date(b.closed_at ?? 0).getTime() -
        new Date(a.closed_at ?? 0).getTime(),
    );
    return rows;
  }, [data]);

  const closedTest = useMemo(() => {
    const rows = [...closedTestTradesFromPayload(data)];
    rows.sort(
      (a, b) =>
        new Date(b.closed_at ?? 0).getTime() -
        new Date(a.closed_at ?? 0).getTime(),
    );
    return rows;
  }, [data]);

  const recentTrades = useMemo(
    () =>
      [...closedLive.map((row) => ({ row, mode: "live" as const })), ...closedTest.map((row) => ({ row, mode: "test" as const }))]
        .sort(
          (a, b) =>
            new Date(b.row.closed_at ?? 0).getTime() -
            new Date(a.row.closed_at ?? 0).getTime(),
        )
        .slice(0, 8),
    [closedLive, closedTest],
  );

  const isPaperMode = String(data?.mode ?? "").toLowerCase() === "paper";

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-16">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center">
            <div className="mb-4 h-10 w-10 animate-pulse rounded-full border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(52,211,153,0.18)]" />
            <div className="text-base font-medium text-white">Loading live monitor</div>
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

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-6 pt-4 sm:px-5 sm:pb-8 sm:pt-5 md:px-6 md:pt-6">
          <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:rounded-[30px]">
            <div className="border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 md:px-8">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                    Live Monitor
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-[2rem] font-semibold tracking-tight text-white sm:text-[2.4rem]">
                      Live
                    </h1>
                    <div className="text-sm text-white/50">
                      Feed health, exposure, and recent fills in one view.
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/45 sm:text-xs">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      Polling every 3 seconds
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      Last poll: {formatTimestamp(data?.updated)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      {positions.length} open
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      {closedLive.length} live closed · {closedTest.length} test closed
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8">
              {error ? (
                <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/8 p-4 text-center">
                  <div className="text-sm font-medium uppercase tracking-[0.2em] text-red-300">
                    Live Feed Error
                  </div>
                  <div className="mt-2 text-sm text-red-200">{error}</div>
                </div>
              ) : null}

              {isPaperMode ? (
                <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4 text-center">
                  <div className="text-sm font-medium uppercase tracking-[0.2em] text-amber-300">
                    Paper Session Detected
                  </div>
                  <div className="mt-2 text-sm text-amber-100">
                    The current upstream feed looks like paper trading. Use the Paper page for the separated view.
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
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

              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_0.85fr]">
                <SectionShell
                  title="Account Snapshot"
                  subtitle="Live and test balances in one compact comparison."
                  right={
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                        Live
                      </span>
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300">
                        Test
                      </span>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-medium text-white">Live Account</div>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/50">
                          {closedLive.length} closed
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        <CompactMetric title="Cash" value={money(data?.live_cash)} />
                        <CompactMetric title="Equity" value={money(data?.live_equity)} />
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
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-medium text-white">Test Account</div>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/50">
                          {closedTest.length} closed
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        <CompactMetric title="Cash" value={money(data?.test_cash)} />
                        <CompactMetric title="Equity" value={money(data?.test_equity)} />
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
                    </div>
                  </div>
                </SectionShell>

                <SectionShell
                  title="Recent Closed Trades"
                  subtitle="Latest completed fills across both feeds."
                  right={
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/45">
                      {recentTrades.length} shown
                    </span>
                  }
                >
                  {recentTrades.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
                      No completed live or test trades yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {recentTrades.map(({ row, mode }, idx) => (
                        <TradeCard
                          key={row.trade_id ?? `${row.option_symbol ?? row.symbol ?? mode}-${idx}`}
                          row={row}
                          mode={mode}
                        />
                      ))}
                    </div>
                  )}
                </SectionShell>
              </div>

              <div className="mt-4">
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
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
                      No open positions right now.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {positions.map((row, idx) => {
                        const openPl = toNumber(row.open_pnl ?? row.open_pl);
                        const openPct = toNumber(row.open_pnl_pct ?? row.open_pl_pct);

                        return (
                          <div
                            key={`${row.option_symbol ?? row.symbol ?? "pos"}-${idx}`}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-white">
                                  {(row.display_symbol ?? row.symbol ?? "—").slice(0, 2).toUpperCase()}
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

                                  <div className="mt-1 break-all text-sm text-white/45">{row.option_symbol ?? "—"}</div>
                                </div>
                              </div>

                              <div className="text-left sm:text-right">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Open P/L</div>
                                <div className={`mt-1 text-xl font-semibold ${perfTone(openPl)}`}>
                                  {signedMoney(openPl)}
                                </div>
                                <div className={`mt-1 text-sm ${perfTone(openPct)}`}>
                                  {`${openPct > 0 ? "+" : ""}${openPct.toFixed(2)}%`}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2.5">
                              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                                <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Entry</div>
                                <div className="mt-1 text-sm font-medium text-white">{money(row.entry_price)}</div>
                              </div>

                              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                                <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Mark</div>
                                <div className="mt-1 text-sm font-medium text-white">{money(row.mark)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionShell>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,18,25,0.75),rgba(8,10,15,0.9))] px-4 py-2.5 text-xs text-white/50">
                Live refreshes every 3 seconds while this page is open. Use Trades for attribution and Overview for investor-facing summaries.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
