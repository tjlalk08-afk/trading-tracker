export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";

type WindowKey = "1d" | "7d" | "30d" | "all";

function asWindow(v: any): WindowKey {
  return v === "1d" || v === "7d" || v === "30d" || v === "all" ? v : "all";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const w = asWindow(typeof searchParams?.w === "string" ? searchParams.w : "all");

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

  // --- TradingView windowed stats (from views that use window_key) ---
  const { data: tvStatsRows } = await supabase.from("tv_stats_windows").select("*");
  const tvStats = (tvStatsRows ?? []).find((r: any) => r.window_key === w);

  const { data: tvByRows } = await supabase
    .from("tv_stats_by_symbol_tf_windows")
    .select("*")
    .eq("window_key", w)
    .limit(50);

  const { data: ddRow } = await supabase
    .from("tv_drawdown_max_windows")
    .select("*")
    .eq("window_key", w)
    .maybeSingle();

  const { data: equityRows } = await supabase
    .from("tv_equity_windows")
    .select("*")
    .eq("window_key", w)
    .order("exit_time", { ascending: true })
    .limit(200);

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

  const WindowLink = ({ keyName, label }: { keyName: WindowKey; label: string }) => (
    <a
      href={`/dashboard?w=${keyName}`}
      style={{
        padding: "6px 10px",
        border: "1px solid #ddd",
        textDecoration: "none",
        background: w === keyName ? "#111" : "#fff",
        color: w === keyName ? "#fff" : "#111",
        borderRadius: 6,
        fontSize: 12,
      }}
    >
      {label}
    </a>
  );

  return (
    <main style={{ padding: 24, fontFamily: "Arial" }}>
      <h1>Dashboard</h1>

      {/* Window selector */}
      <section style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <WindowLink keyName="1d" label="Today" />
        <WindowLink keyName="7d" label="Last 7d" />
        <WindowLink keyName="30d" label="Last 30d" />
        <WindowLink keyName="all" label="All time" />
      </section>

      {/* TradingView Strategy Stats */}
      <section style={{ marginTop: 20 }}>
        <h2>TradingView Strategy Stats ({w})</h2>

        {tvStats ? (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div><b>Trades:</b> {tvStats.trades ?? 0}</div>
            <div><b>Net PnL:</b> {tvStats.net_pnl ?? 0}</div>
            <div><b>Gross Profit:</b> {tvStats.gross_profit ?? 0}</div>
            <div><b>Gross Loss:</b> {tvStats.gross_loss ?? 0}</div>
            <div>
              <b>Profit Factor:</b>{" "}
              {tvStats.profit_factor == null ? "—" : Number(tvStats.profit_factor).toFixed(3)}
            </div>
            <div>
              <b>Win Rate:</b>{" "}
              {tvStats.win_rate_pct == null ? "—" : `${Number(tvStats.win_rate_pct).toFixed(2)}%`}
            </div>
            <div>
              <b>Avg Win:</b>{" "}
              {tvStats.avg_win == null ? "—" : Number(tvStats.avg_win).toFixed(4)}
            </div>
            <div>
              <b>Avg Loss:</b>{" "}
              {tvStats.avg_loss == null ? "—" : Number(tvStats.avg_loss).toFixed(4)}
            </div>
            <div>
              <b>Expectancy:</b>{" "}
              {tvStats.expectancy == null ? "—" : Number(tvStats.expectancy).toFixed(4)}
            </div>
            <div>
              <b>Max Drawdown:</b>{" "}
              {ddRow?.max_drawdown == null ? "—" : Number(ddRow.max_drawdown).toFixed(4)}
            </div>
          </div>
        ) : (
          <p>No completed trades yet for this window.</p>
        )}

        <h3 style={{ marginTop: 16 }}>Equity Curve (last 200 closed trades)</h3>
        {equityRows?.length ? (
          <div style={{ border: "1px solid #ddd", padding: 10 }}>
            {equityRows.slice(-30).map((r: any) => (
              <div key={r.exit_time} style={{ fontSize: 12, opacity: 0.85 }}>
                {new Date(r.exit_time).toLocaleString()} — equity: {Number(r.equity).toFixed(4)} | dd:{" "}
                {Number(r.drawdown).toFixed(4)}
              </div>
            ))}
          </div>
        ) : (
          <p>No equity points yet.</p>
        )}

        <h3 style={{ marginTop: 16 }}>By Symbol / Timeframe</h3>
        {tvByRows?.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {tvByRows.map((r: any) => (
              <div
                key={`${r.window_key}-${r.strategy}-${r.symbol}-${r.timeframe}`}
                style={{ border: "1px solid #ddd", padding: 10 }}
              >
                <b>{r.symbol}</b> — ({r.timeframe ?? "?"}){" "}
                <span style={{ opacity: 0.85 }}>
                  | Trades: {r.trades ?? 0}
                  {" | "}Net: {r.net_pnl ?? 0}
                  {" | "}WR: {r.win_rate_pct ?? "—"}%
                  {" | "}PF: {r.profit_factor ?? "—"}
                  {" | "}Exp: {r.expectancy == null ? "—" : Number(r.expectancy).toFixed(4)}
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
              <b>{s.symbol ?? "(no symbol)"}</b> — {s.action ?? "(no action)"} ({s.timeframe ?? "?"})
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
