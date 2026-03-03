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

async function getBotState(): Promise<BotPayload> {
  const h = await headers();
  const host = h.get("host");

  // Vercel requests are always https. Local dev is http.
  const proto = process.env.VERCEL ? "https" : "http";
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/bot/dashboard`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load bot dashboard");
  return res.json();
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

function KpiRow({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-xl border border-white/10 bg-black/20 p-3"
        >
          <div className="text-xs opacity-60">{label}</div>
          <div className="text-lg font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
}

export default async function BotPage() {
  const payload = await getBotState();
  const d = payload?.data ?? {};

  // Live fields (support both legacy + live_ keys)
  const updated = d.updated ?? "—";
  const cash = Number(d.live_cash ?? d.cash ?? 0);
  const equity = Number(d.live_equity ?? d.equity ?? 0);
  const realized = Number(d.live_realized_pnl ?? d.realized_pnl ?? 0);
  const open = Number(d.live_open_pnl ?? d.open_pnl ?? 0);
  const total = Number(d.live_total_pnl ?? d.total_pnl ?? 0);

  // Test fields (your JSON uses test_*)
  const testCash = Number(d.test_cash ?? 0);
  const testEquity = Number(d.test_equity ?? 0);
  const testRealized = Number(d.test_realized_pnl ?? 0);
  const testOpen = Number(d.test_open_pnl ?? 0);
  const testTotal = Number(d.test_total_pnl ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-semibold">Bot Dashboard</div>
          <div className="text-sm opacity-70">
            Updated: {updated}
            {payload?.ts ? ` • ts: ${payload.ts}` : ""}
          </div>
        </div>

        <a
          href="https://dashboard.ngtdashboard.com/dashboard"
          target="_blank"
          className="text-sm underline opacity-80"
        >
          Legacy Bot UI
        </a>
      </div>

      <Section title="LIVE">
        <KpiRow
          items={[
            ["Cash", money(cash)],
            ["Equity", money(equity)],
            ["Realized P/L", money(realized)],
            ["Open P/L", money(open)],
            ["Total P/L", money(total)],
          ]}
        />
      </Section>

      <Section title="TEST SHADOW">
        <KpiRow
          items={[
            ["Cash", money(testCash)],
            ["Equity", money(testEquity)],
            ["Realized P/L", money(testRealized)],
            ["Open P/L", money(testOpen)],
            ["Total P/L", money(testTotal)],
          ]}
        />
      </Section>

      {/* Debug (remove later if you want) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold mb-2">Raw payload (debug)</div>
        <pre className="text-xs overflow-auto whitespace-pre-wrap opacity-80">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}