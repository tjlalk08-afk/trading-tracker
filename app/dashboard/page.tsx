export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";

export default async function DashboardPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // --- TradingView Signals (raw) ---
  const { data: signals } = await supabase
    .from("tv_signals")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(10);

  // --- TradingView Stats (derived from tv_trades via views) ---
  const { data: tvOverall } = await supabase
    .from("tv_stats_overall")
    .select("*")
    .maybeSingle();

  const { data: tvBySymbolTf } = await supabase
    .from("tv_stats_by_symbol_tf")
    .select("*")
    .limit(50);

  // --- Bot data ---
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

      {/* TradingView Strategy Stats */}
      <section style={{ marginTop: 20 }}>
        <h2>TradingView Strategy Stats</h2>

        {tvOverall ? (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div>
              <b>Trades:</b> {tvOverall.trades ?? 0}
            </div>
            <div>
              <b>Net PnL:</b> {tvOverall.net_pnl ?? 0}
            </div>
            <div>
              <b>Gross Profit:</b> {tvOverall.gross_profit ?? 0}
            </div>
            <div>
              <b>Gross Loss:</b> {tvOverall.gross_loss ?? 0}
            </div>
            <div>
              <b>Profit Factor:</b>{" "}
              {tvOverall.profit_factor === null || tvOverall.profit_factor === undefined
                ? "—"
                : Number(tvOverall.profit_factor).toFixed(3)}
            </div>
            <div>
              <b>Win Rate:</b>{" "}
              {tvOverall.win_rate_pct === null || tvOverall.win_rate_pct === undefined
                ? "—"
                : `${Number(tvOverall.win_rate_pct).toFixed(2)}%`}
            </div>
            <div>
              <b>Avg PnL:</b>{" "}
              {tvOverall.avg_pnl === null || tvOverall.avg_pnl === undefined
                ? "—"
                : Number(tvOverall.avg_pnl).toFixed(4)}
            </div>
          </div>
        ) : (
          <p>No completed trades yet (tv_trades needs CLOSE signals to compute stats).</p>
        )}

        <h3 style={{ marginTop: 16 }}>By Symbol / Timeframe</h3>
        {tvBySymbolTf?.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {tvBySymbolTf.map((r: any) => (
              <div
                key={`${r.strategy}-${r.symbol}-${r.timeframe}`}
                style={{ border: "1px solid #ddd", padding: 10 }}
              >
                <b>{r.symbol}</b> — ({r.timeframe ?? "?"}){" "}
                <span style={{ opacity: 0.8 }}>
                  | Trades: {r.trades ?? 0}
                  {" | "}Net: {r.net_pnl ?? 0}
                  {" | "}WR: {r.win_rate_pct ?? "—"}%
                  {" | "}PF: {r.profit_factor ?? "—"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p>No breakdown rows yet.</p>
        )}
      </section>

      {/* TradingView Signals */}
      <section style={{ marginTop: 28 }}>
        <h2>TradingView Signals</h2>
        {signals?.length ? (
          signals.map((s: any) => (
            <div key={s.id} style={{ border: "1px solid #ddd", padding: 10, marginBottom: 8 }}>
              <b>{s.symbol ?? "(no symbol)"}</b> — {s.action ?? "(no action)"} (
              {s.timeframe ?? "?"})
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {s.received_at ? new Date(s.received_at).toLocaleString() : ""}
              </div>
            </div>
          ))
        ) : (
          <p>No signals yet.</p>
        )}
      </section>

      {/* Bot Performance */}
      <section style={{ marginTop: 28 }}>
        <h2>Bot Performance</h2>

        <h3>Latest Snapshot</h3>
        <pre style={{ background: "#f7f7f7", padding: 10 }}>
          {snap ? JSON.stringify(snap, null, 2) : "none yet"}
        </pre>

        <h3>Recent Trades</h3>
        {trades?.length ? (
          trades.map((t: any) => (
            <div key={t.id} style={{ border: "1px solid #ddd", padding: 10, marginBottom: 8 }}>
              <b>{t.symbol}</b> — {t.side} qty {t.qty} | PnL: {t.pnl}
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {t.closed_at ? new Date(t.closed_at).toLocaleString() : ""}
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
