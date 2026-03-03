import Link from "next/link";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type BotPayload = {
  ok: boolean;
  data?: Record<string, any>;
  ts?: string;
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

async function getBotState(): Promise<BotPayload | null> {
  try {
    const h = await headers();
    const host = h.get("host");
    const proto = process.env.VERCEL ? "https" : "http";
    const base = `${proto}://${host}`;

    const res = await fetch(`${base}/api/bot/dashboard`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function Card({
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
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs opacity-60">{sub}</div> : null}
    </div>
  );
}

export default async function DashboardHome() {
  const payload = await getBotState();
  const d = payload?.data ?? {};

  const updated = d.updated ?? "—";

  // Live fields (support both legacy + live_ keys)
  const cash = Number(d.live_cash ?? d.cash ?? 0);
  const equity = Number(d.live_equity ?? d.equity ?? 0);
  const realized = Number(d.live_realized_pnl ?? d.realized_pnl ?? 0);
  const open = Number(d.live_open_pnl ?? d.open_pnl ?? 0);
  const total = Number(d.live_total_pnl ?? d.total_pnl ?? 0);

  // Test fields
  const testEquity = Number(d.test_equity ?? 0);
  const testTotal = Number(d.test_total_pnl ?? 0);

  const botOk = payload?.ok === true;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="text-sm opacity-70">
            {botOk ? `Bot feed: LIVE • Updated: ${updated}` : "Bot feed: unavailable"}
            {payload?.ts ? ` • ts: ${payload.ts}` : ""}
          </div>
        </div>

        <div className="flex gap-4">
          <Link
            href="/dashboard/bot"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Bot Details
          </Link>

          <a
            href="https://dashboard.ngtdashboard.com/dashboard"
            target="_blank"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Legacy Bot UI
          </a>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card title="Cash" value={money(cash)} />
        <Card title="Equity" value={money(equity)} />
        <Card title="Realized P/L" value={money(realized)} />
        <Card title="Open P/L" value={money(open)} />
        <Card title="Total P/L" value={money(total)} />
      </div>

      {/* Quick panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="text-sm font-semibold">Test Shadow Snapshot</div>
          <div className="text-xs opacity-70">
            Fast check to compare LIVE vs TEST at a glance.
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Card title="Test Equity" value={money(testEquity)} />
            <Card title="Test Total P/L" value={money(testTotal)} />
          </div>
          <div className="pt-2">
            <Link
              href="/dashboard/bot"
              className="text-sm underline opacity-80 hover:opacity-100"
            >
              View full bot breakdown →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="text-sm font-semibold">Strategy</div>
          <div className="text-xs opacity-70">
            Compare live vs paper performance and tuning.
          </div>
          <div className="pt-2">
            <Link
              href="/dashboard/strategy"
              className="text-sm underline opacity-80 hover:opacity-100"
            >
              Go to Strategy →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="text-sm font-semibold">Signals</div>
          <div className="text-xs opacity-70">
            TradingView webhook log and signal validation.
          </div>
          <div className="pt-2">
            <Link
              href="/dashboard/tradingview"
              className="text-sm underline opacity-80 hover:opacity-100"
            >
              Go to TradingView Log →
            </Link>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="text-xs opacity-60">
        {botOk
          ? "Bot status: connected"
          : "Bot status: not connected (check /api/bot/dashboard)"}{" "}
        • Domain: ngtdashboard.com • Data source: dashboard.ngtdashboard.com/api/dashboard
      </div>
    </div>
  );
}