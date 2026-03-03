"use client";

import { useEffect, useMemo, useState } from "react";

type BotPayload = {
  ok?: boolean;
  data?: Record<string, any>;
  ts?: string;
  error?: string;
  status?: number;
};

type PositionRow = {
  symbol: string;
  side: string;
  qty: number | null;
  entry: number | null;
  mark: number | null;
  openPnl: number | null;
  openPnlPct: number | null;
  optionSymbol: string;
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function num(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function pct(n: number) {
  return `${n.toFixed(2)}%`;
}
function getNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function normRow(r: any): PositionRow {
  return {
    symbol: String(pick(r, ["symbol", "ticker", "underlying", "sym"]) ?? "").toUpperCase(),
    side: String(pick(r, ["side", "dir", "direction"]) ?? "").toUpperCase(),
    qty: getNum(pick(r, ["qty", "quantity", "contracts"])),
    entry: getNum(pick(r, ["entry", "entry_price", "avg_entry", "avgEntry"])),
    mark: getNum(pick(r, ["mark", "mark_price", "mid", "price"])),
    openPnl: getNum(pick(r, ["open_pnl", "openPnl", "pnl", "unrealized", "unrealized_pnl"])),
    openPnlPct: getNum(pick(r, ["open_pnl_pct", "openPnlPct", "pnl_pct", "unrealized_pct"])),
    optionSymbol: String(pick(r, ["option_symbol", "optionSymbol", "contract", "contract_symbol"]) ?? ""),
  };
}

/**
 * Your bot may store positions in:
 * - data.positions (object or arrays)
 * - data.live_positions / data.test_shadow_positions
 * - data.positions.live / data.positions.test
 */
function normalizePositions(payload: BotPayload): { live: PositionRow[]; test: PositionRow[] } {
  const d = payload?.data ?? {};

  // 1) Try common direct arrays first
  const liveDirect = pick(d, ["live_positions", "LIVE_POSITIONS", "positions_live"]) as any;
  const testDirect = pick(d, ["test_shadow_positions", "TEST_SHADOW_POSITIONS", "positions_test"]) as any;

  if (Array.isArray(liveDirect) || Array.isArray(testDirect)) {
    return {
      live: Array.isArray(liveDirect) ? liveDirect.map(normRow) : [],
      test: Array.isArray(testDirect) ? testDirect.map(normRow) : [],
    };
  }

  // 2) Try `positions`
  const p = d.positions;
  if (!p) return { live: [], test: [] };

  // Empty object
  if (typeof p === "object" && !Array.isArray(p) && Object.keys(p).length === 0) {
    return { live: [], test: [] };
  }

  // positions = { live: [...], test: [...] }
  if (typeof p === "object" && !Array.isArray(p)) {
    const liveArr = pick(p, ["live", "LIVE", "real", "REAL"]) as any;
    const testArr = pick(p, ["test", "TEST", "shadow", "SHADOW", "test_shadow"]) as any;

    if (Array.isArray(liveArr) || Array.isArray(testArr)) {
      return {
        live: Array.isArray(liveArr) ? liveArr.map(normRow) : [],
        test: Array.isArray(testArr) ? testArr.map(normRow) : [],
      };
    }

    // positions is keyed in some way — best-effort scan
    const keys = Object.keys(p);
    let live: any[] = [];
    let test: any[] = [];

    for (const k of keys) {
      const v = p[k];
      const lk = k.toLowerCase();
      if (Array.isArray(v)) {
        if (lk.includes("test") || lk.includes("shadow")) test = test.concat(v);
        else live = live.concat(v);
      } else if (v && typeof v === "object") {
        const maybeSymbol = pick(v, ["symbol", "ticker", "underlying", "sym"]);
        const maybeSide = pick(v, ["side", "dir", "direction"]);
        if (maybeSymbol || maybeSide) {
          if (lk.includes("test") || lk.includes("shadow")) test.push(v);
          else live.push(v);
        }
      }
    }

    return { live: live.map(normRow), test: test.map(normRow) };
  }

  // positions = flat array
  if (Array.isArray(p)) {
    return { live: p.map(normRow), test: [] };
  }

  return { live: [], test: [] };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs uppercase tracking-wider opacity-60">{title}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Table({ title, rows }: { title: string; rows: PositionRow[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs opacity-60">{rows.length} open</div>
      </div>

      <div className="overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider opacity-70">
            <tr>
              <th className="text-left p-3">Symbol</th>
              <th className="text-left p-3">Side</th>
              <th className="text-right p-3">Qty</th>
              <th className="text-right p-3">Entry</th>
              <th className="text-right p-3">Mark</th>
              <th className="text-right p-3">Open P/L</th>
              <th className="text-right p-3">Open %</th>
              <th className="text-left p-3">Option Symbol</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {rows.length === 0 ? (
              <tr>
                <td className="p-4 text-xs opacity-70" colSpan={8}>
                  No open positions.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={`${r.symbol}-${r.optionSymbol}-${idx}`} className="hover:bg-white/5">
                  <td className="p-3 font-medium">{r.symbol || "—"}</td>
                  <td className="p-3">{r.side || "—"}</td>
                  <td className="p-3 text-right">{r.qty === null ? "—" : num(r.qty)}</td>
                  <td className="p-3 text-right">{r.entry === null ? "—" : num(r.entry)}</td>
                  <td className="p-3 text-right">{r.mark === null ? "—" : num(r.mark)}</td>
                  <td className="p-3 text-right">{r.openPnl === null ? "—" : money(r.openPnl)}</td>
                  <td className="p-3 text-right">{r.openPnlPct === null ? "—" : pct(r.openPnlPct)}</td>
                  <td className="p-3 text-xs opacity-80">{r.optionSymbol || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BotDashboardClient({ initial }: { initial: BotPayload }) {
  const [payload, setPayload] = useState<BotPayload>(initial);
  const [refreshMs, setRefreshMs] = useState<number>(1000);

  const d = payload?.data ?? {};
  const connected = payload?.ok === true;

  // ✅ Use the exact legacy keys first
  const updated = d.updated ?? "—";
  const cash = Number(d.cash ?? 0);
  const equity = Number(d.equity ?? 0);

  const liveRealized = Number(d.live_realized_pnl ?? 0);
  const liveOpen = Number(d.live_open_pnl ?? 0);
  const liveTotal = Number(d.live_total_pnl ?? 0);

  const testCash = Number(d.test_cash ?? 0);
  const testEquity = Number(d.test_equity ?? 0);
  const testRealized = Number(d.test_realized_pnl ?? 0);
  const testOpen = Number(d.test_open_pnl ?? 0);
  const testTotal = Number(d.test_total_pnl ?? 0);

  const positions = useMemo(() => normalizePositions(payload), [payload]);

  useEffect(() => {
    if (!refreshMs) return;

    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/bot/dashboard", { cache: "no-store" });
        if (!res.ok) return;
        const next = await res.json();
        setPayload(next);
      } catch {
        // ignore
      }
    }, refreshMs);

    return () => clearInterval(id);
  }, [refreshMs]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-semibold">Bot Dashboard</div>
          <div className="text-sm opacity-70">
            Status: {connected ? "connected" : "not connected"} • Updated: {updated}
            {payload?.ts ? ` • ts: ${payload.ts}` : ""}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs opacity-60">Auto refresh</div>
          <select
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
            value={refreshMs}
            onChange={(e) => setRefreshMs(Number(e.target.value))}
          >
            <option value={0}>Off</option>
            <option value={1000}>1s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
          </select>

          <a
            href="https://dashboard.ngtdashboard.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Legacy Bot UI
          </a>
        </div>
      </div>

      <Section title="LIVE">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard title="Cash" value={money(cash)} />
          <KpiCard title="Live Realized" value={money(liveRealized)} />
          <KpiCard title="Live Open" value={money(liveOpen)} />
          <KpiCard title="Live Total" value={money(liveTotal)} />
          <KpiCard title="Equity" value={money(equity)} />
        </div>
      </Section>

      <Section title="TEST SHADOW">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard title="Cash" value={money(testCash)} />
          <KpiCard title="Equity" value={money(testEquity)} />
          <KpiCard title="Realized" value={money(testRealized)} />
          <KpiCard title="Open" value={money(testOpen)} />
          <KpiCard title="Total" value={money(testTotal)} />
        </div>
      </Section>

      {/* TEMP DEBUG so we can see how your bot exposes positions */}
      <Section title="DEBUG: positions raw">
        <pre className="text-xs overflow-auto whitespace-pre-wrap opacity-80">
          {JSON.stringify(d.positions ?? null, null, 2)}
        </pre>
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Table title="LIVE POSITIONS" rows={positions.live} />
        <Table title="TEST SHADOW POSITIONS" rows={positions.test} />
      </div>
    </div>
  );
}