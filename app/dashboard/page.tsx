export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";

export default async function DashboardPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: signals } = await supabase
    .from("tv_signals")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(10);

  const { data: trades } = await supabase
    .from("bot_trades")
    .select("*")
    .order("closed_at", { ascending: false })
    .limit(10);

  const { data: snap } = await supabase
    .from("bot_snapshots")
    .select("*")
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main style={{ padding: 24, fontFamily: "Arial" }}>
      <h1>Dashboard</h1>

      <section style={{ marginTop: 20 }}>
        <h2>TradingView Signals</h2>
        {signals?.length ? (
          signals.map((s) => (
            <div key={s.id} style={{ border: "1px solid #ddd", padding: 10, marginBottom: 8 }}>
              <b>{s.symbol ?? "(no symbol)"}</b> — {s.action ?? "(no action)"} ({s.timeframe ?? "?"})
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {new Date(s.received_at).toLocaleString()}
              </div>
            </div>
          ))
        ) : (
          <p>No signals yet.</p>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Bot Performance</h2>

        <h3>Latest Snapshot</h3>
        <pre style={{ background: "#f7f7f7", padding: 10 }}>
          {snap ? JSON.stringify(snap, null, 2) : "none yet"}
        </pre>

        <h3>Recent Trades</h3>
        {trades?.length ? (
          trades.map((t) => (
            <div key={t.id} style={{ border: "1px solid #ddd", padding: 10, marginBottom: 8 }}>
              <b>{t.symbol}</b> — {t.side} qty {t.qty} | PnL: {t.pnl}
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {new Date(t.closed_at).toLocaleString()}
              </div>
            </div>
          ))
        ) : (
          <p>No trades yet.</p>
        )}
      </section>
    </main>
  );
}
