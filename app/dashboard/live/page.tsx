"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LivePayload = {
  ok: boolean;
  data?: {
    updated?: string;

    cash?: number;
    realized_pl?: number;
    open_pnl?: number;
    total_pnl?: number;
    equity?: number;

    live_cash?: number;
    live_realized_pnl?: number;
    live_open_pnl?: number;
    live_total_pnl?: number;
    live_equity?: number;

    test_cash?: number;
    test_realized_pnl?: number;
    test_open_pnl?: number;
    test_total_pnl?: number;
    test_equity?: number;

    positions?: Record<string, any>;
  };
  ts?: string;
  error?: string;
};

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wider opacity-60">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function LivePage() {
  const [payload, setPayload] = useState<LivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadLive() {
    try {
      const res = await fetch("/api/bot/dashboard", {
        cache: "no-store",
      });

      const json: LivePayload = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load live dashboard");
      }

      setPayload(json);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Failed to load live dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLive();

    function startPolling() {
      if (timerRef.current) return;
      timerRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          loadLive();
        }
      }, 1000);
    }

    function stopPolling() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        loadLive();
        startPolling();
      } else {
        stopPolling();
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const d = payload?.data ?? {};
  const positions = useMemo(() => {
    return Object.entries(d.positions ?? {});
  }, [d.positions]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Live Monitor</h1>
        <div className="text-sm opacity-70">
          Polls the brother dashboard every second while this page is open.
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm opacity-70">
          Loading live dashboard...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <StatCard title="Cash" value={money(d.cash)} />
            <StatCard title="Equity" value={money(d.equity)} />
            <StatCard title="Realized P/L" value={money(d.realized_pl)} />
            <StatCard title="Open P/L" value={money(d.open_pnl)} />
            <StatCard title="Total P/L" value={money(d.total_pnl)} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-lg font-semibold">Live Account</div>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatCard title="Cash" value={money(d.live_cash)} />
                <StatCard title="Equity" value={money(d.live_equity)} />
                <StatCard title="Realized" value={money(d.live_realized_pnl)} />
                <StatCard title="Open" value={money(d.live_open_pnl)} />
                <StatCard title="Total" value={money(d.live_total_pnl)} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-lg font-semibold">Test Account</div>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatCard title="Cash" value={money(d.test_cash)} />
                <StatCard title="Equity" value={money(d.test_equity)} />
                <StatCard title="Realized" value={money(d.test_realized_pnl)} />
                <StatCard title="Open" value={money(d.test_open_pnl)} />
                <StatCard title="Total" value={money(d.test_total_pnl)} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold">Open Positions</div>
            <div className="mt-4">
              {positions.length === 0 ? (
                <div className="text-sm opacity-70">No open positions right now.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-white/10 text-xs uppercase tracking-wider opacity-60">
                      <tr>
                        <th className="px-4 py-3 text-left">Symbol</th>
                        <th className="px-4 py-3 text-left">Side</th>
                        <th className="px-4 py-3 text-left">Qty</th>
                        <th className="px-4 py-3 text-left">Entry</th>
                        <th className="px-4 py-3 text-left">Mark</th>
                        <th className="px-4 py-3 text-left">Open P/L</th>
                        <th className="px-4 py-3 text-left">Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(([symbol, raw]) => {
                        const p = raw as Record<string, any>;
                        return (
                          <tr key={symbol} className="border-b border-white/5">
                            <td className="px-4 py-3">{symbol}</td>
                            <td className="px-4 py-3">{p.side ?? "—"}</td>
                            <td className="px-4 py-3">{String(p.qty ?? "—")}</td>
                            <td className="px-4 py-3">{money(p.entry_price)}</td>
                            <td className="px-4 py-3">{money(p.mark_price)}</td>
                            <td className="px-4 py-3">{money(p.open_pl)}</td>
                            <td className="px-4 py-3">{p.mode ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}