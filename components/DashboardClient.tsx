"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function DashboardClient({
  windowKey,
  botStats,
  botEquityRows,
  trades,
  tvStats,
}: any) {
  const fmt = (v: any, d = 2) =>
    v == null ? "—" : Number(v).toFixed(d);

  const StatCard = ({ label, value }: any) => (
    <div
      style={{
        background: "white",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>
        {value}
      </div>
    </div>
  );

  return (
    <main
      style={{
        padding: 40,
        fontFamily: "Inter, sans-serif",
        background: "#f4f6f8",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ marginBottom: 30 }}>
        Performance Dashboard ({windowKey})
      </h1>

      {/* BOT SECTION */}
      <section>
        <h2 style={{ marginBottom: 15 }}>Bot Performance</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 20,
          }}
        >
          <StatCard label="Trades" value={botStats?.trades ?? 0} />
          <StatCard label="Net PnL" value={`$${fmt(botStats?.net_pnl)}`} />
          <StatCard label="Win Rate" value={`${fmt(botStats?.win_rate_pct)}%`} />
          <StatCard label="Profit Factor" value={fmt(botStats?.profit_factor)} />
          <StatCard label="Expectancy" value={fmt(botStats?.expectancy)} />
        </div>
      </section>

      {/* EQUITY CHART */}
      <section style={{ marginTop: 50 }}>
        <h2>Equity Curve</h2>

        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={botEquityRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="closed_at"
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString()
                }
              />
              <YAxis />
              <Tooltip
                labelFormatter={(v) =>
                  new Date(v).toLocaleString()
                }
              />
              <Line
                type="monotone"
                dataKey="equity"
                stroke="#2563eb"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* TV COMPARISON */}
      <section style={{ marginTop: 50 }}>
        <h2>TradingView Comparison</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 20,
          }}
        >
          <StatCard label="TV Trades" value={tvStats?.trades ?? 0} />
          <StatCard label="TV Net PnL" value={`$${fmt(tvStats?.net_pnl)}`} />
          <StatCard label="TV Win Rate" value={`${fmt(tvStats?.win_rate_pct)}%`} />
          <StatCard label="TV Profit Factor" value={fmt(tvStats?.profit_factor)} />
          <StatCard label="TV Expectancy" value={fmt(tvStats?.expectancy)} />
        </div>
      </section>
    </main>
  );
}