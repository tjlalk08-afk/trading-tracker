"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Snapshot = {
  id: number;
  source: string;
  snapshot_ts: string;
  updated_text: string | null;

  cash: number;
  realized_pl: number;
  open_pl: number;
  total_pl: number;
  equity: number;

  live_cash: number;
  live_realized_pl: number;
  live_open_pl: number;
  live_total_pl: number;
  live_equity: number;

  test_cash: number;
  test_realized_pl: number;
  test_open_pl: number;
  test_total_pl: number;
  test_equity: number;

  realized_pct: number | null;
  open_pct: number | null;
  total_pct: number | null;

  live_realized_pct: number | null;
  live_open_pct: number | null;
  live_total_pct: number | null;

  test_realized_pct: number | null;
  test_open_pct: number | null;
  test_total_pct: number | null;

  created_at: string;
};

type LatestPayload = {
  ok: boolean;
  data?: Snapshot | null;
  error?: string;
};

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

function pct(n: number | null | undefined) {
  return `${Number(n ?? 0).toFixed(2)}%`;
}

function timeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return "—";

  const ms = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(ms)) return "—";

  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wider opacity-60">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs opacity-60">{sub}</div> : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="text-[11px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs opacity-60">{sub}</div> : null}
    </div>
  );
}

export default function DashboardHome() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadLatest() {
    try {
      setError("");
      const res = await fetch("/api/dashboard-latest", {
        cache: "no-store",
      });

      const json: LatestPayload = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load latest snapshot");
      }

      setData(json.data ?? null);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard snapshot");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSnapshot() {
    try {
      setRefreshing(true);
      setError("");

      const res = await fetch("/api/ingest/brother-dashboard", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to refresh snapshot");
      }

      await loadLatest();
    } catch (err: any) {
      setError(err?.message || "Failed to refresh snapshot");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadLatest();
  }, []);

  const hasSnapshot = !!data;
  const snapshotAge = timeAgo(data?.snapshot_ts);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          <div className="text-sm opacity-70">
            Snapshot of the day and what has happened so far.
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={refreshSnapshot}
            disabled={refreshing}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh Snapshot"}
          </button>

          <Link
            href="/dashboard/performance"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Performance
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm opacity-70">
          Loading snapshot...
        </div>
      ) : !hasSnapshot ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">No snapshot saved yet</div>
          <div className="mt-2 text-sm opacity-70">
            Click Refresh Snapshot to pull the first one from your brother’s dashboard.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <StatCard title="Equity" value={money(data.equity)} />
            <StatCard
              title="Today Realized P/L"
              value={money(data.realized_pl)}
              sub={pct(data.realized_pct)}
            />
            <StatCard
              title="Current Open P/L"
              value={money(data.open_pl)}
              sub={pct(data.open_pct)}
            />
            <StatCard
              title="Today Total P/L"
              value={money(data.total_pl)}
              sub={pct(data.total_pct)}
            />
            <StatCard title="Cash" value={money(data.cash)} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div>
                <div className="text-lg font-semibold">Live Today</div>
                <div className="text-xs opacity-70">
                  Saved live-account snapshot from the brother dashboard.
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <MiniStat label="Equity" value={money(data.live_equity)} />
                <MiniStat
                  label="Realized"
                  value={money(data.live_realized_pl)}
                  sub={pct(data.live_realized_pct)}
                />
                <MiniStat
                  label="Open"
                  value={money(data.live_open_pl)}
                  sub={pct(data.live_open_pct)}
                />
                <MiniStat
                  label="Total"
                  value={money(data.live_total_pl)}
                  sub={pct(data.live_total_pct)}
                />
                <MiniStat label="Cash" value={money(data.live_cash)} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div>
                <div className="text-lg font-semibold">Test Today</div>
                <div className="text-xs opacity-70">
                  Shadow/test snapshot saved alongside the live account.
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <MiniStat label="Equity" value={money(data.test_equity)} />
                <MiniStat
                  label="Realized"
                  value={money(data.test_realized_pl)}
                  sub={pct(data.test_realized_pct)}
                />
                <MiniStat
                  label="Open"
                  value={money(data.test_open_pl)}
                  sub={pct(data.test_open_pct)}
                />
                <MiniStat
                  label="Total"
                  value={money(data.test_total_pl)}
                  sub={pct(data.test_total_pct)}
                />
                <MiniStat label="Cash" value={money(data.test_cash)} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold">Snapshot Status</div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-[11px] uppercase tracking-wider opacity-60">
                  Source
                </div>
                <div className="mt-1 text-sm font-medium">{data.source}</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-[11px] uppercase tracking-wider opacity-60">
                  Snapshot Time
                </div>
                <div className="mt-1 text-sm font-medium">{data.snapshot_ts}</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-[11px] uppercase tracking-wider opacity-60">
                  Snapshot Age
                </div>
                <div className="mt-1 text-sm font-medium">{snapshotAge}</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-[11px] uppercase tracking-wider opacity-60">
                  Brother Updated
                </div>
                <div className="mt-1 text-sm font-medium">
                  {data.updated_text ?? "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs opacity-60">
            This page is a saved day snapshot, not a live stream. Data source:
            dashboard.ngtdashboard.com/api/dashboard → saved into Supabase.
          </div>
        </>
      )}
    </div>
  );
}