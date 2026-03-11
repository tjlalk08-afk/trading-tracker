"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

type Snapshot = {
  id: number;
  source?: string;
  snapshot_ts: string;
  updated_text?: string | null;

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

  realized_pct?: number | null;
  open_pct?: number | null;
  total_pct?: number | null;

  live_realized_pct?: number | null;
  live_open_pct?: number | null;
  live_total_pct?: number | null;

  test_realized_pct?: number | null;
  test_open_pct?: number | null;
  test_total_pct?: number | null;

  created_at: string;
};

type TradeRow = {
  id?: number | string;
  snapshot_date?: string | null;
  trade_day?: string | null;
  symbol?: string | null;
  side?: string | null;
  qty?: number | null;
  entry_price?: number | null;
  exit_price?: number | null;
  realized_pl?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
  source?: string | null;
  external_trade_id?: string | null;
};

type LatestPayload = {
  ok: boolean;
  data?: Snapshot | null;
  error?: string;
};

type HistoryPayload = {
  ok: boolean;
  data?: Snapshot[];
  error?: string;
};

type TradeHistoryPayload = {
  ok: boolean;
  data?: TradeRow[];
  error?: string;
};

type DailyComparePoint = {
  dayKey: string;
  label: string;
  snapshotTs: string;
  liveEquity: number;
  testEquity: number;
  liveTotal: number;
  testTotal: number;
  liveRealized: number;
  testRealized: number;
  liveOpen: number;
  testOpen: number;
  liveCash: number;
  testCash: number;
};

type TradeRange = "7D" | "30D" | "1Y" | "ALL";
type TradeSourceFilter = "ALL" | "LIVE" | "TEST";

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

function signedMoney(n: number | null | undefined) {
  const value = Number(n ?? 0);
  const abs = money(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function signedPct(n: number | null | undefined) {
  const value = Number(n ?? 0);
  const fixed = value.toFixed(2);
  if (value > 0) return `+${fixed}%`;
  return `${fixed}%`;
}

function ageMinutes(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 60000));
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

function formatDateTimeCT(dateStr: string | null | undefined) {
  if (!dateStr) return "—";

  const date = new Date(dateStr);
  if (!Number.isFinite(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatShortDateCT(dateStr: string | null | undefined) {
  if (!dateStr) return "—";

  const date = new Date(dateStr);
  if (!Number.isFinite(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
  }).format(date);
}

function ctDayKey(dateStr: string) {
  const date = new Date(dateStr);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function freshnessState(dateStr: string | null | undefined) {
  const mins = ageMinutes(dateStr);

  if (mins === null) {
    return {
      label: "Unknown",
      detail: "Snapshot timing unavailable",
      badgeClass: "border-white/10 bg-white/[0.05] text-white/70",
    };
  }

  if (mins <= 15) {
    return {
      label: "Fresh",
      detail: "Recently saved snapshot",
      badgeClass: "border-emerald-400/20 bg-emerald-500/12 text-emerald-300",
    };
  }

  if (mins <= 60) {
    return {
      label: "Delayed",
      detail: "Refresh recommended soon",
      badgeClass: "border-amber-400/20 bg-amber-500/12 text-amber-300",
    };
  }

  return {
    label: "Refresh Needed",
    detail: "Older saved snapshot",
    badgeClass: "border-red-400/20 bg-red-500/12 text-red-300",
  };
}

function pnlTextClass(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (n > 0) return "text-emerald-300";
  if (n < 0) return "text-red-300";
  return "text-white";
}

function isFlatish(value: number | null | undefined) {
  return Math.abs(Number(value ?? 0)) < 0.005;
}

function gapHeadline(value: number) {
  return isFlatish(value) ? "Tied" : signedMoney(value);
}

function gapSupport(value: number, flatLabel: string) {
  return isFlatish(value) ? flatLabel : "Live minus test";
}

function getLast<T>(arr: T[]) {
  return arr[arr.length - 1];
}

function normalizeTradeSource(source: string | null | undefined): "LIVE" | "TEST" | "OTHER" {
  const s = String(source ?? "").trim().toLowerCase();

  if (!s) return "OTHER";
  if (s === "live" || s === "actual" || s === "real" || s === "prod" || s === "production") {
    return "LIVE";
  }
  if (s === "test" || s === "paper" || s === "shadow" || s === "sim" || s === "simulated") {
    return "TEST";
  }
  if (s.includes("live") || s.includes("actual") || s.includes("real")) return "LIVE";
  if (s.includes("test") || s.includes("paper") || s.includes("shadow")) return "TEST";

  return "OTHER";
}

function tradeTimestamp(row: TradeRow) {
  return row.closed_at || row.trade_day || row.opened_at || row.snapshot_date || null;
}

function isClosedTrade(row: TradeRow) {
  return !!(row.closed_at || row.exit_price !== null || row.realized_pl !== null);
}

function getDailyCompareRows(rows: Snapshot[]) {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.snapshot_ts).getTime() - new Date(b.snapshot_ts).getTime()
  );

  const map = new Map<string, Snapshot>();

  for (const row of sorted) {
    map.set(ctDayKey(row.snapshot_ts), row);
  }

  return Array.from(map.entries())
    .map(([dayKey, row]) => ({
      dayKey,
      label: formatShortDateCT(row.snapshot_ts),
      snapshotTs: row.snapshot_ts,
      liveEquity: Number(row.live_equity ?? 0),
      testEquity: Number(row.test_equity ?? 0),
      liveTotal: Number(row.live_total_pl ?? 0),
      testTotal: Number(row.test_total_pl ?? 0),
      liveRealized: Number(row.live_realized_pl ?? 0),
      testRealized: Number(row.test_realized_pl ?? 0),
      liveOpen: Number(row.live_open_pl ?? 0),
      testOpen: Number(row.test_open_pl ?? 0),
      liveCash: Number(row.live_cash ?? 0),
      testCash: Number(row.test_cash ?? 0),
    }))
    .sort((a, b) => new Date(a.snapshotTs).getTime() - new Date(b.snapshotTs).getTime());
}

function getMaxDrawdown(values: number[]) {
  if (!values.length) {
    return { amount: 0, pct: 0 };
  }

  let peak = values[0];
  let maxAmount = 0;
  let maxPct = 0;

  for (const value of values) {
    if (value > peak) peak = value;

    const drawdown = peak - value;
    const drawdownPct = peak ? (drawdown / peak) * 100 : 0;

    if (drawdown > maxAmount) {
      maxAmount = drawdown;
      maxPct = drawdownPct;
    }
  }

  return { amount: maxAmount, pct: maxPct };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getTradeRangeStart(range: TradeRange) {
  const now = new Date();

  if (range === "ALL") return null;

  const d = new Date(now);
  if (range === "7D") {
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (range === "30D") {
    d.setDate(d.getDate() - 30);
    return d;
  }

  d.setFullYear(d.getFullYear() - 1);
  return d;
}

function Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-white/10",
        "bg-[linear-gradient(180deg,rgba(18,24,33,0.88),rgba(8,11,17,0.94))]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_12px_30px_rgba(0,0,0,0.28)]",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.07),transparent_26%),radial-gradient(circle_at_bottom_center,rgba(59,130,246,0.05),transparent_30%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">{children}</div>;
}

function InfoRow({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/8 py-2 last:border-b-0">
      <div className="text-sm text-white/45">{label}</div>
      <div className={`text-right text-sm font-medium ${valueClass}`}>{value}</div>
    </div>
  );
}

function RangeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-300"
          : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.07] hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function HeroBanner({
  headline,
  detail,
  toneClass,
}: {
  headline: string;
  detail: string;
  toneClass: string;
}) {
  return (
    <Surface className="p-3.5">
      <SectionLabel>Current Comparison</SectionLabel>
      <div className={`mt-1.5 text-[1.55rem] font-semibold ${toneClass}`}>{headline}</div>
      <div className="mt-1.5 max-w-2xl text-sm text-white/56">{detail}</div>
    </Surface>
  );
}

function GapCard({
  title,
  value,
  support,
  tone = "text-white",
}: {
  title: string;
  value: string;
  support: string;
  tone?: string;
}) {
  return (
    <Surface className="p-3.5">
      <SectionLabel>{title}</SectionLabel>
      <div className={`mt-2 text-[1.45rem] font-semibold ${tone}`}>{value}</div>
      <div className="mt-1.5 text-sm text-white/55">{support}</div>
    </Surface>
  );
}

function AccountMetric({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className={`mt-1.5 text-xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function CompareAccountPanel({
  title,
  subtitle,
  badge,
  badgeClass,
  equity,
  realized,
  open,
  total,
  cash,
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeClass: string;
  equity: number;
  realized: number;
  open: number;
  total: number;
  cash: number;
}) {
  return (
    <Surface className="p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel>{title}</SectionLabel>
          <div className="mt-1.5 text-[2rem] font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-white/55">{subtitle}</div>
        </div>

        <div className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${badgeClass}`}>
          {badge}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 xl:grid-cols-5">
        <AccountMetric label="Equity" value={money(equity)} />
        <AccountMetric label="Realized" value={signedMoney(realized)} tone={pnlTextClass(realized)} />
        <AccountMetric label="Open" value={signedMoney(open)} tone={pnlTextClass(open)} />
        <AccountMetric label="Total" value={signedMoney(total)} tone={pnlTextClass(total)} />
        <AccountMetric label="Cash" value={money(cash)} />
      </div>
    </Surface>
  );
}

function BriefStat({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className={`mt-1.5 text-base font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function LegendPill({
  colorClass,
  label,
  value,
}: {
  colorClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
        <div className="text-xs font-medium text-white/80">{label}</div>
        <div className="text-xs text-white/50">{value}</div>
      </div>
    </div>
  );
}

function SourcePill({ source }: { source: "LIVE" | "TEST" }) {
  const cls =
    source === "LIVE"
      ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-300"
      : "border-cyan-400/20 bg-cyan-500/12 text-cyan-300";

  return (
    <div className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${cls}`}>
      {source === "LIVE" ? "Live" : "Test"}
    </div>
  );
}

function CompareEquityChart({ rows }: { rows: DailyComparePoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const width = 960;
  const height = 250;
  const padLeft = 26;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 28;

  if (rows.length < 2) {
    return (
      <div className="flex h-[245px] flex-col items-center justify-center gap-2 text-center">
        <div className="text-sm font-medium text-white/75">More daily snapshots needed</div>
        <div className="max-w-md text-sm text-white/45">
          Save snapshots across multiple days to unlock a clearer live-versus-test comparison curve.
        </div>
      </div>
    );
  }

  const allValues = rows.flatMap((r) => [r.liveEquity, r.testEquity]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;

  const tiedSeries = rows.every((r) => isFlatish(r.liveEquity - r.testEquity));

  const toPoint = (value: number, index: number) => {
    const x = padLeft + (index / (rows.length - 1)) * (width - padLeft - padRight);
    const y = padTop + (1 - (value - min) / span) * (height - padTop - padBottom);
    return { x, y };
  };

  const livePoints = rows.map((r, i) => ({
    ...toPoint(r.liveEquity, i),
    value: r.liveEquity,
    label: r.label,
  }));

  const testPoints = rows.map((r, i) => ({
    ...toPoint(r.testEquity, i),
    value: r.testEquity,
    label: r.label,
  }));

  const liveLine = livePoints.map((p) => `${p.x},${p.y}`).join(" ");
  const testLine = testPoints.map((p) => `${p.x},${p.y}`).join(" ");

  const activeIndex = hoveredIndex ?? rows.length - 1;
  const hoverLive = livePoints[activeIndex];
  const hoverTest = testPoints[activeIndex];
  const hoverLeft = `${(hoverLive.x / width) * 100}%`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[245px] w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((n) => {
          const y = padTop + (height - padTop - padBottom) * n;
          return (
            <line
              key={n}
              x1={padLeft}
              x2={width - padRight}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          );
        })}

        {tiedSeries ? (
          <polyline
            fill="none"
            stroke="rgba(226,232,240,0.88)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={liveLine}
          />
        ) : (
          <>
            <polyline
              fill="none"
              stroke="rgba(34,197,94,0.96)"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={liveLine}
            />
            <polyline
              fill="none"
              stroke="rgba(34,211,238,0.96)"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={testLine}
            />
          </>
        )}

        {livePoints.map((p, idx) => (
          <circle
            key={`live-${idx}`}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === idx ? 5 : 3}
            fill={tiedSeries ? "rgba(226,232,240,0.95)" : "rgba(34,197,94,1)"}
            stroke="rgba(5,8,13,1)"
            strokeWidth="2"
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="cursor-pointer"
          />
        ))}

        {!tiedSeries &&
          testPoints.map((p, idx) => (
            <circle
              key={`test-${idx}`}
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === idx ? 5 : 3}
              fill="rgba(34,211,238,1)"
              stroke="rgba(5,8,13,1)"
              strokeWidth="2"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            />
          ))}
      </svg>

      {tiedSeries ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-white/10 bg-[#081019]/90 px-4 py-2 text-sm text-white/72">
            Live and test are tracking together across saved days.
          </div>
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-xl border border-white/10 bg-[#081019]/95 px-3 py-2 text-xs"
        style={{ left: hoverLeft }}
      >
        <div className="font-medium text-white">{rows[activeIndex].label}</div>
        <div className="mt-1 text-emerald-300">Live: {money(hoverLive.value)}</div>
        <div className="mt-1 text-cyan-300">Test: {money(hoverTest.value)}</div>
        <div className="mt-1 text-white/55">Gap: {signedMoney(hoverLive.value - hoverTest.value)}</div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-white/45">
        <div>{rows[0].label}</div>
        <div>{getLast(rows).label}</div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tradeRange, setTradeRange] = useState<TradeRange>("30D");
  const [tradeSource, setTradeSource] = useState<TradeSourceFilter>("ALL");
  const [tradeHistoryOpen, setTradeHistoryOpen] = useState(false);

  const loadAll = useCallback(async () => {
    const [latestRes, historyRes, tradesRes] = await Promise.all([
      fetch("/api/dashboard-latest", { cache: "no-store" }),
      fetch("/api/dashboard-history", { cache: "no-store" }),
      fetch("/api/trade-history", { cache: "no-store" }),
    ]);

    const latestJson: LatestPayload = await latestRes.json();
    const historyJson: HistoryPayload = await historyRes.json();
    const tradesJson: TradeHistoryPayload = await tradesRes.json();

    if (!latestRes.ok || !latestJson?.ok) {
      throw new Error(latestJson?.error || "Failed to load latest snapshot");
    }

    if (!historyRes.ok || !historyJson?.ok) {
      throw new Error(historyJson?.error || "Failed to load dashboard history");
    }

    if (!tradesRes.ok || !tradesJson?.ok) {
      throw new Error(tradesJson?.error || "Failed to load trade history");
    }

    setLatest(latestJson.data ?? null);
    setHistory(historyJson.data ?? []);
    setTrades(tradesJson.data ?? []);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        setError("");
        await loadAll();
      } catch (err: any) {
        setError(err?.message || "Failed to load compare data");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [loadAll]);

  const freshness = freshnessState(latest?.snapshot_ts);
  const snapshotAge = timeAgo(latest?.snapshot_ts);

  const latestGaps = useMemo(() => {
    if (!latest) {
      return {
        equityGap: 0,
        totalGap: 0,
        realizedGap: 0,
        openGap: 0,
        cashGap: 0,
      };
    }

    return {
      equityGap: Number(latest.live_equity ?? 0) - Number(latest.test_equity ?? 0),
      totalGap: Number(latest.live_total_pl ?? 0) - Number(latest.test_total_pl ?? 0),
      realizedGap: Number(latest.live_realized_pl ?? 0) - Number(latest.test_realized_pl ?? 0),
      openGap: Number(latest.live_open_pl ?? 0) - Number(latest.test_open_pl ?? 0),
      cashGap: Number(latest.live_cash ?? 0) - Number(latest.test_cash ?? 0),
    };
  }, [latest]);

  const comparisonLeader = useMemo(() => {
    const { totalGap, equityGap } = latestGaps;
    if (!isFlatish(totalGap)) return totalGap > 0 ? "Live" : "Test";
    if (!isFlatish(equityGap)) return equityGap > 0 ? "Live" : "Test";
    return "Tied";
  }, [latestGaps]);

  const hero = useMemo(() => {
    if (comparisonLeader === "Tied") {
      return {
        headline: "Live and test are tied right now.",
        detail:
          "The latest saved snapshot shows both accounts tracking together. Compare stays focused on account alignment, while trading history is available below when you want the deeper breakdown.",
        toneClass: "text-white",
      };
    }

    const leadGap = !isFlatish(latestGaps.totalGap)
      ? Math.abs(latestGaps.totalGap)
      : Math.abs(latestGaps.equityGap);

    return {
      headline: `${comparisonLeader} is ahead right now.`,
      detail: `${comparisonLeader} is leading by ${money(
        leadGap
      )} in the latest saved snapshot. Use this page to check whether account gaps and trade-level results remain aligned.`,
      toneClass: comparisonLeader === "Live" ? "text-emerald-300" : "text-cyan-300",
    };
  }, [comparisonLeader, latestGaps]);

  const dailyRows = useMemo(() => getDailyCompareRows(history), [history]);
  const daysTracked = dailyRows.length;

  const liveDrawdown = useMemo(() => getMaxDrawdown(dailyRows.map((r) => r.liveEquity)), [dailyRows]);
  const testDrawdown = useMemo(() => getMaxDrawdown(dailyRows.map((r) => r.testEquity)), [dailyRows]);

  const avgEquityGap = useMemo(
    () => average(dailyRows.map((r) => Math.abs(r.liveEquity - r.testEquity))),
    [dailyRows]
  );

  const maxEquityGap = useMemo(
    () => Math.max(0, ...dailyRows.map((r) => Math.abs(r.liveEquity - r.testEquity))),
    [dailyRows]
  );

  const recentDays = useMemo(() => [...dailyRows].slice(-2).reverse(), [dailyRows]);

  const chartSummary = useMemo(() => {
    if (!dailyRows.length) {
      return { liveCurrent: 0, testCurrent: 0, gap: 0 };
    }
    const last = getLast(dailyRows);
    return {
      liveCurrent: last.liveEquity,
      testCurrent: last.testEquity,
      gap: last.liveEquity - last.testEquity,
    };
  }, [dailyRows]);

  const filteredTrades = useMemo(() => {
    const start = getTradeRangeStart(tradeRange);

    return trades
      .filter((row) => normalizeTradeSource(row.source) !== "OTHER")
      .filter((row) => isClosedTrade(row))
      .filter((row) => {
        if (tradeSource === "ALL") return true;
        return normalizeTradeSource(row.source) === tradeSource;
      })
      .filter((row) => {
        if (!start) return true;
        const ts = tradeTimestamp(row);
        if (!ts) return false;
        const time = new Date(ts).getTime();
        if (!Number.isFinite(time)) return false;
        return time >= start.getTime();
      })
      .sort((a, b) => {
        const at = new Date(tradeTimestamp(a) || 0).getTime();
        const bt = new Date(tradeTimestamp(b) || 0).getTime();
        return bt - at;
      });
  }, [trades, tradeRange, tradeSource]);

  const liveTrades = useMemo(
    () => filteredTrades.filter((row) => normalizeTradeSource(row.source) === "LIVE"),
    [filteredTrades]
  );

  const testTrades = useMemo(
    () => filteredTrades.filter((row) => normalizeTradeSource(row.source) === "TEST"),
    [filteredTrades]
  );

  const liveTradeSummary = useMemo(() => {
    const realized = liveTrades.map((t) => Number(t.realized_pl ?? 0));
    const wins = realized.filter((v) => v > 0).length;
    const losses = realized.filter((v) => v < 0).length;
    const net = realized.reduce((sum, v) => sum + v, 0);
    return {
      count: liveTrades.length,
      wins,
      losses,
      net,
      avg: average(realized),
      winRate: liveTrades.length ? (wins / liveTrades.length) * 100 : 0,
    };
  }, [liveTrades]);

  const testTradeSummary = useMemo(() => {
    const realized = testTrades.map((t) => Number(t.realized_pl ?? 0));
    const wins = realized.filter((v) => v > 0).length;
    const losses = realized.filter((v) => v < 0).length;
    const net = realized.reduce((sum, v) => sum + v, 0);
    return {
      count: testTrades.length,
      wins,
      losses,
      net,
      avg: average(realized),
      winRate: testTrades.length ? (wins / testTrades.length) * 100 : 0,
    };
  }, [testTrades]);

  const tradeGapSummary = useMemo(() => {
    return {
      tradeCountGap: liveTradeSummary.count - testTradeSummary.count,
      netGap: liveTradeSummary.net - testTradeSummary.net,
      winRateGap: liveTradeSummary.winRate - testTradeSummary.winRate,
    };
  }, [liveTradeSummary, testTradeSummary]);

  const hasData = !!latest;

  return (
    <div className="relative isolate space-y-2 overflow-hidden pt-1">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.08),transparent_30%)]" />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-semibold tracking-tight text-white">Compare</h1>

            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
              Saved Snapshots
            </div>

            <div
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${freshness.badgeClass}`}
            >
              {freshness.label}
            </div>
          </div>

          <div className="mt-2 max-w-3xl text-sm text-white/58">
            Side-by-side live versus test account comparison across saved snapshots, daily history, and optional trade history.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">
            Last saved: <span className="font-medium text-white">{snapshotAge}</span>
          </div>

          <Link
            href="/dashboard/live"
            className="rounded-xl border border-cyan-400/20 bg-cyan-500/12 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/18"
          >
            Live
          </Link>

          <Link
            href="/dashboard/performance"
            className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08]"
          >
            Performance
          </Link>
        </div>
      </div>

      {error ? (
        <Surface className="border-red-400/20 bg-red-500/10 p-4">
          <div className="text-sm text-red-300">{error}</div>
        </Surface>
      ) : null}

      {loading ? (
        <Surface className="p-6">
          <div className="text-sm text-white/65">Loading compare page...</div>
        </Surface>
      ) : !hasData ? (
        <Surface className="p-6">
          <div className="text-xl font-semibold text-white">No snapshot saved yet</div>
          <div className="mt-2 text-sm text-white/58">
            Save your first snapshot and this compare view will populate automatically.
          </div>
        </Surface>
      ) : (
        <>
          <HeroBanner headline={hero.headline} detail={hero.detail} toneClass={hero.toneClass} />

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            <GapCard
              title="Equity Gap"
              value={gapHeadline(latestGaps.equityGap)}
              support={gapSupport(latestGaps.equityGap, `${money(0)} difference`)}
              tone={pnlTextClass(latestGaps.equityGap)}
            />
            <GapCard
              title="Total P/L Gap"
              value={gapHeadline(latestGaps.totalGap)}
              support={gapSupport(latestGaps.totalGap, `${money(0)} difference`)}
              tone={pnlTextClass(latestGaps.totalGap)}
            />
            <GapCard
              title="Realized Gap"
              value={gapHeadline(latestGaps.realizedGap)}
              support={gapSupport(latestGaps.realizedGap, `${money(0)} difference`)}
              tone={pnlTextClass(latestGaps.realizedGap)}
            />
            <GapCard
              title="Open P/L Gap"
              value={gapHeadline(latestGaps.openGap)}
              support={gapSupport(latestGaps.openGap, `${money(0)} difference`)}
              tone={pnlTextClass(latestGaps.openGap)}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            <CompareAccountPanel
              title="Live"
              subtitle="Latest saved live snapshot."
              badge="Live"
              badgeClass="border-emerald-400/20 bg-emerald-500/12 text-emerald-300"
              equity={latest.live_equity}
              realized={latest.live_realized_pl}
              open={latest.live_open_pl}
              total={latest.live_total_pl}
              cash={latest.live_cash}
            />

            <CompareAccountPanel
              title="Test"
              subtitle="Latest saved test snapshot."
              badge="Test"
              badgeClass="border-cyan-400/20 bg-cyan-500/12 text-cyan-300"
              equity={latest.test_equity}
              realized={latest.test_realized_pl}
              open={latest.test_open_pl}
              total={latest.test_total_pl}
              cash={latest.test_cash}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            <GapCard
              title="Days Tracked"
              value={String(daysTracked)}
              support="Unique saved days available for comparison"
            />
            <GapCard
              title="Cash Gap"
              value={gapHeadline(latestGaps.cashGap)}
              support={gapSupport(latestGaps.cashGap, `${money(0)} difference`)}
              tone={pnlTextClass(latestGaps.cashGap)}
            />
            <GapCard
              title="Live Max Drawdown"
              value={isFlatish(liveDrawdown.amount) ? "Steady" : signedMoney(-liveDrawdown.amount)}
              support={
                isFlatish(liveDrawdown.amount)
                  ? "No drawdown across saved days"
                  : signedPct(-liveDrawdown.pct)
              }
              tone={isFlatish(liveDrawdown.amount) ? "text-white" : "text-red-300"}
            />
            <GapCard
              title="Test Max Drawdown"
              value={isFlatish(testDrawdown.amount) ? "Steady" : signedMoney(-testDrawdown.amount)}
              support={
                isFlatish(testDrawdown.amount)
                  ? "No drawdown across saved days"
                  : signedPct(-testDrawdown.pct)
              }
              tone={isFlatish(testDrawdown.amount) ? "text-white" : "text-red-300"}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <Surface className="p-3.5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <SectionLabel>Comparison Trend</SectionLabel>
                    <div className="mt-1 text-[1.8rem] font-semibold text-white">
                      Daily Live vs Test Equity
                    </div>
                    <div className="mt-1 text-sm text-white/55">
                      One saved point per day using the latest snapshot captured for each day.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <LegendPill colorClass="bg-emerald-400" label="Live" value={money(chartSummary.liveCurrent)} />
                    <LegendPill colorClass="bg-cyan-400" label="Test" value={money(chartSummary.testCurrent)} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <BriefStat label="Current Gap" value={signedMoney(chartSummary.gap)} tone={pnlTextClass(chartSummary.gap)} />
                  <BriefStat
                    label="Leader"
                    value={comparisonLeader}
                    tone={
                      comparisonLeader === "Live"
                        ? "text-emerald-300"
                        : comparisonLeader === "Test"
                        ? "text-cyan-300"
                        : "text-white"
                    }
                  />
                  <BriefStat label="Avg Equity Gap" value={money(avgEquityGap)} />
                  <BriefStat label="Max Equity Gap" value={money(maxEquityGap)} />
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-2">
                  <CompareEquityChart rows={dailyRows} />
                </div>
              </Surface>
            </div>

            <div className="xl:col-span-4">
              <Surface className="h-full p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SectionLabel>Summary</SectionLabel>
                    <div className="mt-1 text-[1.8rem] font-semibold text-white">Compare Brief</div>
                    <div className="mt-1 text-sm text-white/55">
                      Quick read on freshness, gaps, and recent day-by-day alignment.
                    </div>
                  </div>

                  <div
                    className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${freshness.badgeClass}`}
                  >
                    {freshness.label}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <BriefStat label="Status" value={freshness.label} />
                  <BriefStat
                    label="Leader"
                    value={comparisonLeader}
                    tone={
                      comparisonLeader === "Live"
                        ? "text-emerald-300"
                        : comparisonLeader === "Test"
                        ? "text-cyan-300"
                        : "text-white"
                    }
                  />
                  <BriefStat
                    label="Gap"
                    value={isFlatish(latestGaps.equityGap) ? "Tight" : "Open"}
                    tone={isFlatish(latestGaps.equityGap) ? "text-white" : "text-amber-300"}
                  />
                </div>

                <div className="mt-3">
                  <InfoRow label="Last saved" value={snapshotAge} />
                  <InfoRow label="Days tracked" value={String(daysTracked)} />
                  <InfoRow label="Avg equity gap" value={money(avgEquityGap)} />
                  <InfoRow
                    label="Current total gap"
                    value={signedMoney(latestGaps.totalGap)}
                    valueClass={pnlTextClass(latestGaps.totalGap)}
                  />
                </div>

                <div className="mt-3 border-t border-white/10 pt-3">
                  <SectionLabel>Recent Days</SectionLabel>
                  <div className="mt-2.5 space-y-2">
                    {recentDays.length ? (
                      recentDays.map((row) => {
                        const gap = row.liveEquity - row.testEquity;

                        return (
                          <div
                            key={row.dayKey}
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-white">{row.label}</div>
                                <div className="text-xs text-white/45">{timeAgo(row.snapshotTs)}</div>
                              </div>

                              <div className={`text-sm font-medium ${pnlTextClass(gap)}`}>
                                {signedMoney(gap)}
                              </div>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                                <div className="uppercase tracking-[0.16em] text-emerald-300/80">Live</div>
                                <div className="mt-1 font-medium text-white/85">{money(row.liveEquity)}</div>
                              </div>
                              <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                                <div className="uppercase tracking-[0.16em] text-cyan-300/80">Test</div>
                                <div className="mt-1 font-medium text-white/85">{money(row.testEquity)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-sm text-white/50">No recent daily comparison yet.</div>
                    )}
                  </div>
                </div>
              </Surface>
            </div>
          </div>

          <Surface className="p-3.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <SectionLabel>Trading History</SectionLabel>
                <div className="mt-1 text-[1.55rem] font-semibold text-white">
                  Live vs Test Closed Trades
                </div>
                <div className="mt-1 text-sm text-white/55">
                  Hidden by default so Compare stays focused on account-level analysis first.
                </div>
              </div>

              <button
                onClick={() => setTradeHistoryOpen((v) => !v)}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/[0.08]"
              >
                {tradeHistoryOpen ? "Hide Trading History" : "Show Trading History"}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <BriefStat label="Live Trades" value={String(liveTradeSummary.count)} />
              <BriefStat label="Test Trades" value={String(testTradeSummary.count)} />
              <BriefStat
                label="Live Realized"
                value={signedMoney(liveTradeSummary.net)}
                tone={pnlTextClass(liveTradeSummary.net)}
              />
              <BriefStat
                label="Test Realized"
                value={signedMoney(testTradeSummary.net)}
                tone={pnlTextClass(testTradeSummary.net)}
              />
              <BriefStat
                label="Net Gap"
                value={signedMoney(tradeGapSummary.netGap)}
                tone={pnlTextClass(tradeGapSummary.netGap)}
              />
              <BriefStat
                label="WR Gap"
                value={signedPct(tradeGapSummary.winRateGap)}
                tone={pnlTextClass(tradeGapSummary.winRateGap)}
              />
            </div>

            {tradeHistoryOpen ? (
              <div className="mt-4 grid grid-cols-1 gap-2 xl:grid-cols-12">
                <div className="xl:col-span-8">
                  <Surface className="p-3.5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <SectionLabel>Trade Ledger</SectionLabel>
                        <div className="mt-1 text-[1.55rem] font-semibold text-white">
                          Recent Closed Trades
                        </div>
                        <div className="mt-1 text-sm text-white/55">
                          Unified trade history with live and test rows in one compact ledger.
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="flex flex-wrap gap-2">
                          <RangeButton active={tradeRange === "7D"} onClick={() => setTradeRange("7D")}>
                            7D
                          </RangeButton>
                          <RangeButton active={tradeRange === "30D"} onClick={() => setTradeRange("30D")}>
                            30D
                          </RangeButton>
                          <RangeButton active={tradeRange === "1Y"} onClick={() => setTradeRange("1Y")}>
                            1Y
                          </RangeButton>
                          <RangeButton active={tradeRange === "ALL"} onClick={() => setTradeRange("ALL")}>
                            All
                          </RangeButton>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <RangeButton active={tradeSource === "ALL"} onClick={() => setTradeSource("ALL")}>
                            All
                          </RangeButton>
                          <RangeButton active={tradeSource === "LIVE"} onClick={() => setTradeSource("LIVE")}>
                            Live
                          </RangeButton>
                          <RangeButton active={tradeSource === "TEST"} onClick={() => setTradeSource("TEST")}>
                            Test
                          </RangeButton>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-white/45">
                            <th className="px-3 py-3 font-medium">Closed</th>
                            <th className="px-3 py-3 font-medium">Symbol</th>
                            <th className="px-3 py-3 font-medium">Side</th>
                            <th className="px-3 py-3 font-medium">Qty</th>
                            <th className="px-3 py-3 font-medium">Entry</th>
                            <th className="px-3 py-3 font-medium">Exit</th>
                            <th className="px-3 py-3 font-medium">Realized</th>
                            <th className="px-3 py-3 font-medium">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTrades.length ? (
                            filteredTrades.slice(0, 14).map((row, idx) => {
                              const src = normalizeTradeSource(row.source);
                              const ts = tradeTimestamp(row);
                              const realized = Number(row.realized_pl ?? 0);

                              return (
                                <tr
                                  key={String(row.id ?? row.external_trade_id ?? `${ts}-${row.symbol}-${idx}`)}
                                  className="border-b border-white/8 text-white/85"
                                >
                                  <td className="px-3 py-3 align-top">
                                    <div>{formatShortDateCT(ts)}</div>
                                    <div className="mt-1 text-xs text-white/40">{timeAgo(ts)}</div>
                                  </td>
                                  <td className="px-3 py-3 align-top font-medium">{row.symbol || "—"}</td>
                                  <td className="px-3 py-3 align-top">{row.side || "—"}</td>
                                  <td className="px-3 py-3 align-top">{row.qty ?? "—"}</td>
                                  <td className="px-3 py-3 align-top">
                                    {row.entry_price === null || row.entry_price === undefined
                                      ? "—"
                                      : money(row.entry_price)}
                                  </td>
                                  <td className="px-3 py-3 align-top">
                                    {row.exit_price === null || row.exit_price === undefined
                                      ? "—"
                                      : money(row.exit_price)}
                                  </td>
                                  <td className={`px-3 py-3 align-top font-medium ${pnlTextClass(realized)}`}>
                                    {signedMoney(realized)}
                                  </td>
                                  <td className="px-3 py-3 align-top">
                                    {src === "LIVE" || src === "TEST" ? <SourcePill source={src} /> : "—"}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={8} className="px-3 py-8 text-center text-white/50">
                                No closed trades found for the selected filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Surface>
                </div>

                <div className="xl:col-span-4">
                  <Surface className="h-full p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <SectionLabel>Trade Summary</SectionLabel>
                        <div className="mt-1 text-[1.55rem] font-semibold text-white">Trading Brief</div>
                        <div className="mt-1 text-sm text-white/55">
                          Quick read on trade count and realized edge.
                        </div>
                      </div>

                      <div
                        className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                          isFlatish(tradeGapSummary.netGap)
                            ? "border-white/10 bg-white/[0.05] text-white/70"
                            : tradeGapSummary.netGap > 0
                            ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-300"
                            : "border-cyan-400/20 bg-cyan-500/12 text-cyan-300"
                        }`}
                      >
                        {isFlatish(tradeGapSummary.netGap)
                          ? "Even"
                          : tradeGapSummary.netGap > 0
                          ? "Live Edge"
                          : "Test Edge"}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <BriefStat label="Trades" value={String(filteredTrades.length)} />
                      <BriefStat
                        label="Net Gap"
                        value={signedMoney(tradeGapSummary.netGap)}
                        tone={pnlTextClass(tradeGapSummary.netGap)}
                      />
                      <BriefStat
                        label="WR Gap"
                        value={signedPct(tradeGapSummary.winRateGap)}
                        tone={pnlTextClass(tradeGapSummary.winRateGap)}
                      />
                    </div>

                    <div className="mt-3">
                      <InfoRow label="Range" value={tradeRange === "1Y" ? "1 Year" : tradeRange} />
                      <InfoRow
                        label="Source filter"
                        value={
                          tradeSource === "ALL"
                            ? "All"
                            : tradeSource === "LIVE"
                            ? "Live only"
                            : "Test only"
                        }
                      />
                      <InfoRow
                        label="Live realized"
                        value={signedMoney(liveTradeSummary.net)}
                        valueClass={pnlTextClass(liveTradeSummary.net)}
                      />
                      <InfoRow
                        label="Test realized"
                        value={signedMoney(testTradeSummary.net)}
                        valueClass={pnlTextClass(testTradeSummary.net)}
                      />
                    </div>
                  </Surface>
                </div>
              </div>
            ) : null}
          </Surface>

          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,18,25,0.75),rgba(8,10,15,0.9))] px-4 py-2.5 text-xs text-white/50">
            Compare is built from saved snapshots and saved trade history in Supabase. Trading History expands only when you want the deeper live-vs-test breakdown.
          </div>
        </>
      )}
    </div>
  );
}