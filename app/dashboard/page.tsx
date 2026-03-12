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

type HealthCheck = {
  status: "ok" | "warn" | "error";
  message: string;
  detail?: string;
};

type HealthPayload = {
  ok: boolean;
  checked_at?: string;
  checks?: {
    config?: HealthCheck;
    bot?: HealthCheck;
    supabase?: HealthCheck;
    snapshot?: HealthCheck;
    trades?: HealthCheck;
    cron?: HealthCheck;
  };
  error?: string;
};

type ChartRange = "7D" | "30D" | "90D" | "ALL";

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

function compactMoney(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

function signedMoney(n: number | null | undefined) {
  const value = Number(n ?? 0);
  const abs = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

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

function pctFromDelta(delta: number, base: number) {
  if (!base) return 0;
  return (delta / base) * 100;
}

function isFlatish(n: number | null | undefined) {
  return Math.abs(Number(n ?? 0)) < 0.005;
}

function deltaHeadline(n: number | null | undefined, flatLabel = "Steady") {
  return isFlatish(n) ? flatLabel : signedMoney(n);
}

function deltaSupport(n: number | null | undefined, pct?: number | null) {
  return isFlatish(n) ? `${signedMoney(n)} • ${signedPct(pct)}` : signedPct(pct);
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

function ageMinutes(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 60000));
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

function pnlTextClass(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (n > 0) return "text-emerald-300";
  if (n < 0) return "text-red-300";
  return "text-white";
}

function pnlBgClass(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (n > 0) return "border-emerald-400/15 bg-emerald-500/[0.07]";
  if (n < 0) return "border-red-400/15 bg-red-500/[0.07]";
  return "border-white/10 bg-black/20";
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

function describeDelta(value: number | null | undefined) {
  const n = Number(value ?? 0);

  if (n > 0) {
    return {
      label: "Higher",
      sentence: "Equity is above the start of this saved window.",
    };
  }

  if (n < 0) {
    return {
      label: "Lower",
      sentence: "Equity is below the start of this saved window.",
    };
  }

  return {
    label: "Flat",
    sentence: "No equity change across the saved snapshots in this window.",
  };
}

function rangeInsightCopy(delta: number, rangeLabel: string) {
  if (delta > 0) return `Equity improved across the selected ${rangeLabel} saved range.`;
  if (delta < 0) return `Equity pulled back across the selected ${rangeLabel} saved range.`;
  return `Equity held steady across the selected ${rangeLabel} saved range.`;
}

function getLast<T>(arr: T[]) {
  return arr[arr.length - 1];
}

function getPeriodStart(period: "week" | "month" | "year") {
  const now = new Date();
  const d = new Date(now);

  if (period === "week") {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  if (period === "month") {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  }

  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function getPeriodStats(rows: Snapshot[], period: "week" | "month" | "year" | "all") {
  if (!rows.length) {
    return {
      delta: 0,
      pct: 0,
      start: null as Snapshot | null,
      end: null as Snapshot | null,
      startEquity: 0,
      endEquity: 0,
    };
  }

  const end = getLast(rows);

  if (period === "all") {
    const start = rows[0];
    const delta = Number(end.equity) - Number(start.equity);
    return {
      delta,
      pct: pctFromDelta(delta, Number(start.equity)),
      start,
      end,
      startEquity: Number(start.equity),
      endEquity: Number(end.equity),
    };
  }

  const startDate = getPeriodStart(period);
  const before = rows.filter((r) => new Date(r.snapshot_ts) < startDate);
  const inside = rows.filter((r) => new Date(r.snapshot_ts) >= startDate);

  const start = getLast(before) ?? inside[0] ?? rows[0];
  const delta = Number(end.equity) - Number(start.equity);

  return {
    delta,
    pct: pctFromDelta(delta, Number(start.equity)),
    start,
    end,
    startEquity: Number(start.equity),
    endEquity: Number(end.equity),
  };
}

function getHistoryForRange(rows: Snapshot[], range: ChartRange) {
  if (range === "ALL") return rows;

  const now = Date.now();
  const days = range === "7D" ? 7 : range === "30D" ? 30 : 90;
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  return rows.filter((r) => new Date(r.snapshot_ts).getTime() >= cutoff);
}

function getMonthlyStats(rows: Snapshot[]) {
  const year = new Date().getFullYear();

  return Array.from({ length: 12 }).map((_, monthIndex) => {
    const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);

    const before = rows.filter((r) => new Date(r.snapshot_ts) < start);
    const inside = rows.filter((r) => {
      const ts = new Date(r.snapshot_ts);
      return ts >= start && ts < end;
    });

    const baseline = getLast(before) ?? inside[0] ?? null;
    const lastInMonth = inside.length ? getLast(inside) : null;

    if (!baseline || !lastInMonth) {
      return {
        label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(start),
        delta: null as number | null,
        pct: null as number | null,
      };
    }

    const delta = Number(lastInMonth.equity) - Number(baseline.equity);
    const pct = pctFromDelta(delta, Number(baseline.equity));

    return {
      label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(start),
      delta,
      pct,
    };
  });
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
  return (
    <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
      {children}
    </div>
  );
}

function DenseBucketCard({
  title,
  delta,
  pct,
  startEquity,
  endEquity,
  startLabel,
}: {
  title: string;
  delta: number;
  pct: number;
  startEquity: number;
  endEquity: number;
  startLabel: string;
}) {
  const descriptor = describeDelta(delta);
  const flat = isFlatish(delta);

  return (
    <Surface className="p-3.5">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{title}</SectionLabel>
        <div
          className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
            flat
              ? "border-white/10 bg-white/[0.04] text-white/60"
              : delta > 0
              ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-300"
              : "border-red-400/20 bg-red-500/12 text-red-300"
          }`}
        >
          {descriptor.label}
        </div>
      </div>

      <div
        className={`mt-2 font-semibold leading-none ${pnlTextClass(delta)} ${
          flat ? "text-[1.65rem]" : "text-[1.95rem]"
        }`}
      >
        {deltaHeadline(delta, "Steady")}
      </div>

      <div className={`mt-1.5 text-sm font-medium ${pnlTextClass(delta)}`}>
        {deltaSupport(delta, pct)}
      </div>

      <div className="mt-1 text-[11px] text-white/48">{descriptor.sentence}</div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
          <div className="uppercase tracking-[0.16em] text-white/35">Start</div>
          <div className="mt-1 font-medium text-white/80">{compactMoney(startEquity)}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
          <div className="uppercase tracking-[0.16em] text-white/35">Now</div>
          <div className="mt-1 font-medium text-white/80">{compactMoney(endEquity)}</div>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-white/45">Since {startLabel}</div>
    </Surface>
  );
}

function TopCard({
  title,
  value,
  sub,
  tone = "text-white",
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <Surface className="h-full p-3.5">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-[2px] w-8 rounded-full bg-emerald-400/80" />
        <div className="h-[2px] w-3 rounded-full bg-cyan-400/50" />
      </div>

      <SectionLabel>{title}</SectionLabel>

      <div className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</div>

      {sub ? <div className="mt-2 text-xs text-white/55">{sub}</div> : null}
    </Surface>
  );
}

function SnapshotStatusCard({
  equity,
  snapshotAge,
  freshness,
  updatedAt,
}: {
  equity: number;
  snapshotAge: string;
  freshness: ReturnType<typeof freshnessState>;
  updatedAt: string | null | undefined;
}) {
  return (
    <Surface className="h-full p-3.5">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-[2px] w-8 rounded-full bg-emerald-400/80" />
        <div className="h-[2px] w-3 rounded-full bg-cyan-400/50" />
      </div>

      <SectionLabel>Snapshot Status</SectionLabel>

      <div className="mt-2 text-2xl font-semibold text-white">{money(equity)}</div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div
          className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${freshness.badgeClass}`}
        >
          {freshness.label}
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
          Saved Snapshot
        </div>
      </div>

      <div className="mt-2 text-xs text-white/55">{freshness.detail}</div>

      <div className="mt-3 space-y-1.5 text-xs text-white/58">
        <div>
          Last saved: <span className="font-medium text-white/80">{snapshotAge}</span>
        </div>
        <div>
          Source updated:{" "}
          <span className="font-medium text-white/80">{formatDateTimeCT(updatedAt)}</span>
        </div>
      </div>
    </Surface>
  );
}

function SmallMetric({
  label,
  value,
  sub,
  tone = "text-white",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <div className={`mt-2 text-xl font-semibold ${tone}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-white/45">{sub}</div> : null}
    </div>
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
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className={`mt-2 text-base font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function AccountPanel({
  title,
  subtitle,
  badge,
  badgeClass,
  equity,
  realized,
  open,
  total,
  cash,
  realizedPct,
  openPct,
  totalPct,
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
  realizedPct?: number | null;
  openPct?: number | null;
  totalPct?: number | null;
}) {
  return (
    <Surface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
            Account
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-white/55">{subtitle}</div>
        </div>

        <div
          className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${badgeClass}`}
        >
          {badge}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-5">
        <SmallMetric label="Equity" value={money(equity)} />
        <SmallMetric
          label="Realized"
          value={signedMoney(realized)}
          sub={signedPct(realizedPct)}
          tone={pnlTextClass(realized)}
        />
        <SmallMetric
          label="Open"
          value={signedMoney(open)}
          sub={signedPct(openPct)}
          tone={pnlTextClass(open)}
        />
        <SmallMetric
          label="Total"
          value={signedMoney(total)}
          sub={signedPct(totalPct)}
          tone={pnlTextClass(total)}
        />
        <SmallMetric label="Cash" value={money(cash)} />
      </div>
    </Surface>
  );
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
    <div className="flex items-center justify-between gap-4 border-b border-white/8 py-2.5 last:border-b-0">
      <div className="text-sm text-white/45">{label}</div>
      <div className={`text-right text-sm font-medium ${valueClass}`}>{value}</div>
    </div>
  );
}

function healthTone(status: "ok" | "warn" | "error" | undefined) {
  if (status === "ok") {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "warn") {
    return "border-amber-400/20 bg-amber-500/10 text-amber-300";
  }

  return "border-red-400/20 bg-red-500/10 text-red-300";
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
          ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.07] hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ChartStat({
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
      <div className={`mt-1 text-sm font-medium ${tone}`}>{value}</div>
    </div>
  );
}

function EquityChart({
  rows,
}: {
  rows: Snapshot[];
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const width = 900;
  const height = 290;
  const padLeft = 22;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 26;

  if (rows.length < 2) {
    return (
      <div className="flex h-[290px] flex-col items-center justify-center gap-2 text-center">
        <div className="text-sm font-medium text-white/75">More snapshot history needed</div>
        <div className="max-w-md text-sm text-white/45">
          The equity trend becomes more useful as additional saved snapshots build over time.
        </div>
      </div>
    );
  }

  const values = rows.map((r) => Number(r.equity ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;
  const span = max - min || 1;

  const points = rows.map((r, i) => {
    const x = padLeft + (i / (rows.length - 1)) * (width - padLeft - padRight);
    const y =
      padTop +
      (1 - (Number(r.equity ?? 0) - min) / span) * (height - padTop - padBottom);
    return { x, y, value: Number(r.equity ?? 0), ts: r.snapshot_ts };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = [
    `${points[0].x},${height - padBottom}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${height - padBottom}`,
  ].join(" ");

  const hoverPoint = hoveredIndex === null ? points[points.length - 1] : points[hoveredIndex];
  const hoverLeft = `${(hoverPoint.x / width) * 100}%`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[290px] w-full">
        <defs>
          <linearGradient id="equityAreaStrong" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(16,185,129,0.36)" />
            <stop offset="55%" stopColor="rgba(34,197,94,0.12)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0.01)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

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

        {flat ? (
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={points[0].y}
            y2={points[0].y}
            stroke="rgba(16,185,129,0.30)"
            strokeWidth="10"
            filter="url(#glow)"
          />
        ) : null}

        <polyline fill="url(#equityAreaStrong)" stroke="none" points={area} />
        <polyline
          fill="none"
          stroke="rgba(16,185,129,0.98)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={line}
          filter="url(#glow)"
        />

        {points.map((p, idx) => (
          <g key={idx}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === idx ? 6.5 : 3.5}
              fill={hoveredIndex === idx ? "rgba(34,197,94,1)" : "rgba(16,185,129,0.9)"}
              stroke="rgba(5,8,13,1)"
              strokeWidth="2"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            />
          </g>
        ))}
      </svg>

      {flat ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-white/10 bg-[#081019]/90 px-4 py-2.5 text-sm text-white/72 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            Equity held steady across this saved range.
          </div>
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute top-3 -translate-x-1/2 rounded-xl border border-white/10 bg-[#081019]/95 px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        style={{ left: hoverLeft }}
      >
        <div className="font-medium text-white">{money(hoverPoint.value)}</div>
        <div className="mt-1 text-white/55">{formatDateTimeCT(hoverPoint.ts)}</div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-white/45">
        <div>{formatShortDateCT(rows[0].snapshot_ts)}</div>
        <div>{formatShortDateCT(getLast(rows).snapshot_ts)}</div>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [chartRange, setChartRange] = useState<ChartRange>("30D");

  const loadAll = useCallback(async () => {
    const [latestRes, historyRes, healthRes] = await Promise.all([
      fetch("/api/dashboard-latest", { cache: "no-store" }),
      fetch("/api/dashboard-history", { cache: "no-store" }),
      fetch("/api/health", { cache: "no-store" }),
    ]);

    const latestJson: LatestPayload = await latestRes.json();
    const historyJson: HistoryPayload = await historyRes.json();
    const healthJson: HealthPayload = await healthRes.json().catch(() => ({
      ok: false,
      error: "Failed to load system health",
    }));

    if (!latestRes.ok || !latestJson?.ok) {
      throw new Error(latestJson?.error || "Failed to load latest snapshot");
    }

    if (!historyRes.ok || !historyJson?.ok) {
      throw new Error(historyJson?.error || "Failed to load dashboard history");
    }

    setLatest(latestJson.data ?? null);
    setHistory(historyJson.data ?? []);
    setHealth(healthJson);
  }, []);

  async function refreshSnapshot() {
    try {
      setRefreshing(true);
      setError("");

      let ingestRes = await fetch("/api/ingest/brother-dashboard", {
        method: "POST",
        cache: "no-store",
      });

      if (!ingestRes.ok) {
        ingestRes = await fetch("/api/ingest/brother-dashboard", {
          method: "GET",
          cache: "no-store",
        });
      }

      const ingestJson = await ingestRes.json().catch(() => null);

      if (!ingestRes.ok) {
        throw new Error(
          ingestJson?.error ||
            ingestJson?.message ||
            "Failed to refresh snapshot from brother dashboard"
        );
      }

      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to refresh snapshot");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      try {
        setError("");
        await loadAll();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [loadAll]);

  const hasSnapshot = !!latest;
  const freshness = freshnessState(latest?.snapshot_ts);
  const snapshotAge = timeAgo(latest?.snapshot_ts);

  const weekStats = useMemo(() => getPeriodStats(history, "week"), [history]);
  const monthStats = useMemo(() => getPeriodStats(history, "month"), [history]);
  const yearStats = useMemo(() => getPeriodStats(history, "year"), [history]);
  const allStats = useMemo(() => getPeriodStats(history, "all"), [history]);

  const chartRows = useMemo(() => {
    const filtered = getHistoryForRange(history, chartRange);
    return filtered.length >= 2 ? filtered : history;
  }, [history, chartRange]);

  const chartSummary = useMemo(() => {
    if (!chartRows.length) {
      return { min: 0, max: 0, latest: 0, delta: 0, pct: 0 };
    }

    const values = chartRows.map((r) => Number(r.equity ?? 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const first = chartRows[0];
    const last = getLast(chartRows);
    const delta = Number(last.equity) - Number(first.equity);

    return {
      min,
      max,
      latest: Number(last.equity),
      delta,
      pct: pctFromDelta(delta, Number(first.equity)),
    };
  }, [chartRows]);

  const monthlyStats = useMemo(() => getMonthlyStats(history), [history]);
  const activeMonthsCount = useMemo(
    () => monthlyStats.filter((m) => m.delta !== null).length,
    [monthlyStats]
  );

  const recentSaves = useMemo(() => {
    return [...history].slice(-4).reverse();
  }, [history]);

  const summary = useMemo(() => {
    if (!latest) return null;

    const liveTotal = Number(latest.live_total_pl ?? 0);
    const testTotal = Number(latest.test_total_pl ?? 0);
    const totalGap = liveTotal - testTotal;

    return {
      leader: totalGap > 0 ? "Live" : totalGap < 0 ? "Test" : "Even",
      totalGap,
      openRead:
        Number(latest.open_pl ?? 0) > 0
          ? "Open exposure currently in profit."
          : Number(latest.open_pl ?? 0) < 0
          ? "Open exposure currently underwater."
          : "No open exposure right now.",
      realizedRead:
        Number(latest.realized_pl ?? 0) > 0
          ? "Positive realized movement today."
          : Number(latest.realized_pl ?? 0) < 0
          ? "Negative realized movement today."
          : "No realized movement in the saved snapshot.",
    };
  }, [latest]);

  const rangeDescriptor = describeDelta(chartSummary.delta);
  const rangeLabel = chartRange === "ALL" ? "all saved history" : chartRange;

  return (
    <div className="relative isolate space-y-3 overflow-hidden pt-1">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.08),transparent_30%)]" />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-semibold tracking-tight text-white">Overview</h1>

            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
              Saved Snapshot
            </div>

            <div
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${freshness.badgeClass}`}
            >
              {freshness.label}
            </div>
          </div>

          <div className="mt-2 max-w-3xl text-sm text-white/58">
            High-level account view for saved performance, trend direction, and live-versus-test comparison.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">
            Last saved: <span className="font-medium text-white">{snapshotAge}</span>
          </div>

          <button
            onClick={() => void refreshSnapshot()}
            disabled={refreshing}
            className="rounded-xl border border-emerald-400/20 bg-emerald-500/12 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Reload Snapshot"}
          </button>

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
          <div className="text-sm text-white/65">Loading dashboard...</div>
        </Surface>
      ) : !hasSnapshot ? (
        <Surface className="p-6">
          <div className="text-xl font-semibold text-white">No snapshot saved yet</div>
          <div className="mt-2 text-sm text-white/58">
            Pull the first snapshot from your dashboard source and the overview will populate automatically.
          </div>
        </Surface>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-5">
            <DenseBucketCard
              title="This Week"
              delta={weekStats.delta}
              pct={weekStats.pct}
              startEquity={weekStats.startEquity}
              endEquity={weekStats.endEquity}
              startLabel={formatShortDateCT(weekStats.start?.snapshot_ts)}
            />
            <DenseBucketCard
              title="This Month"
              delta={monthStats.delta}
              pct={monthStats.pct}
              startEquity={monthStats.startEquity}
              endEquity={monthStats.endEquity}
              startLabel={formatShortDateCT(monthStats.start?.snapshot_ts)}
            />
            <DenseBucketCard
              title="This Year"
              delta={yearStats.delta}
              pct={yearStats.pct}
              startEquity={yearStats.startEquity}
              endEquity={yearStats.endEquity}
              startLabel={formatShortDateCT(yearStats.start?.snapshot_ts)}
            />
            <DenseBucketCard
              title="All Time"
              delta={allStats.delta}
              pct={allStats.pct}
              startEquity={allStats.startEquity}
              endEquity={allStats.endEquity}
              startLabel={formatShortDateCT(allStats.start?.snapshot_ts)}
            />
            <SnapshotStatusCard
              equity={latest.equity}
              snapshotAge={snapshotAge}
              freshness={freshness}
              updatedAt={latest.updated_text}
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <div className="space-y-2.5">
                <Surface className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <SectionLabel>System Status</SectionLabel>
                      <div className="mt-1 text-[2.05rem] font-semibold text-white">
                        Runtime Health
                      </div>
                      <div className="mt-1 text-sm text-white/55">
                        Quick check for config, bot upstream, Supabase, saved snapshots, and daily cron coverage.
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/60">
                      Checked: <span className="text-white/85">{timeAgo(health?.checked_at)}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      { label: "Config", check: health?.checks?.config },
                      { label: "Bot Upstream", check: health?.checks?.bot },
                      { label: "Supabase", check: health?.checks?.supabase },
                      { label: "Snapshots", check: health?.checks?.snapshot },
                      { label: "Trades", check: health?.checks?.trades },
                      { label: "Cron", check: health?.checks?.cron },
                    ].map(({ label, check }) => (
                      <div
                        key={label}
                        className={`rounded-xl border px-3 py-3 ${healthTone(check?.status)}`}
                      >
                        <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">
                          {label}
                        </div>
                        <div className="mt-2 text-sm font-semibold">
                          {check?.message ?? "Unavailable"}
                        </div>
                        <div className="mt-1 text-xs opacity-80">
                          {check?.detail ?? "No extra detail"}
                        </div>
                      </div>
                    ))}
                  </div>
                </Surface>

                <Surface className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <SectionLabel>Performance</SectionLabel>
                      <div className="mt-1 text-[2.05rem] font-semibold text-white">
                        Account Balance
                      </div>
                      <div className="mt-1 text-sm text-white/55">
                        Saved equity trend across the selected snapshot range.
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <RangeButton active={chartRange === "7D"} onClick={() => setChartRange("7D")}>
                        7D
                      </RangeButton>
                      <RangeButton active={chartRange === "30D"} onClick={() => setChartRange("30D")}>
                        30D
                      </RangeButton>
                      <RangeButton active={chartRange === "90D"} onClick={() => setChartRange("90D")}>
                        90D
                      </RangeButton>
                      <RangeButton active={chartRange === "ALL"} onClick={() => setChartRange("ALL")}>
                        All
                      </RangeButton>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
                    <ChartStat label="Current" value={money(chartSummary.latest)} />
                    <ChartStat
                      label="Trend"
                      value={rangeDescriptor.label}
                      tone={pnlTextClass(chartSummary.delta)}
                    />
                    <ChartStat
                      label="Range Return"
                      value={signedMoney(chartSummary.delta)}
                      tone={pnlTextClass(chartSummary.delta)}
                    />
                    <ChartStat
                      label="Range %"
                      value={signedPct(chartSummary.pct)}
                      tone={pnlTextClass(chartSummary.delta)}
                    />
                    <ChartStat label="High" value={money(chartSummary.max)} />
                    <ChartStat label="Low" value={money(chartSummary.min)} />
                  </div>

                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                      Range Insight
                    </div>
                    <div className="mt-1 text-sm text-white/78">
                      {rangeInsightCopy(chartSummary.delta, rangeLabel)}
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-2">
                    <EquityChart rows={chartRows} />
                  </div>
                </Surface>

                <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-3">
                  <TopCard
                    title="Today's Realized"
                    value={deltaHeadline(latest.realized_pl, "Flat")}
                    sub={summary?.realizedRead}
                    tone={pnlTextClass(latest.realized_pl)}
                  />
                  <TopCard
                    title="Open Exposure"
                    value={deltaHeadline(latest.open_pl, "Flat")}
                    sub={summary?.openRead}
                    tone={pnlTextClass(latest.open_pl)}
                  />
                  <TopCard
                    title="Today's Total"
                    value={deltaHeadline(latest.total_pl, "Flat")}
                    sub={deltaSupport(latest.total_pl, latest.total_pct)}
                    tone={pnlTextClass(latest.total_pl)}
                  />
                </div>
              </div>
            </div>

            <div className="xl:col-span-4">
              <Surface className="h-full p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SectionLabel>Summary</SectionLabel>
                    <div className="mt-1 text-[2.05rem] font-semibold text-white">
                      Snapshot Brief
                    </div>
                    <div className="mt-1 text-sm text-white/55">
                      Quick read on freshness, direction, and account comparison.
                    </div>
                  </div>

                  <div
                    className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${freshness.badgeClass}`}
                  >
                    {freshness.label}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <BriefStat label="Status" value={freshness.label} tone={pnlTextClass(0)} />
                  <BriefStat
                    label="Leader"
                    value={summary?.leader ?? "—"}
                    tone={pnlTextClass(summary?.totalGap ?? 0)}
                  />
                  <BriefStat
                    label="Trend"
                    value={rangeDescriptor.label}
                    tone={pnlTextClass(chartSummary.delta)}
                  />
                </div>

                <div className="mt-3">
                  <InfoRow label="Last saved" value={snapshotAge} />
                  <InfoRow label="Source updated" value={formatDateTimeCT(latest.updated_text)} />
                  <InfoRow
                    label="Leader gap"
                    value={signedMoney(summary?.totalGap ?? 0)}
                    valueClass={pnlTextClass(summary?.totalGap ?? 0)}
                  />
                  <InfoRow label="Selected range" value={chartRange === "ALL" ? "All" : chartRange} />
                  <InfoRow
                    label="Range return"
                    value={signedMoney(chartSummary.delta)}
                    valueClass={pnlTextClass(chartSummary.delta)}
                  />
                  <InfoRow label="Saved history" value={`${history.length} snapshots`} />
                  <InfoRow label="Range coverage" value={`${chartRows.length} points`} />
                </div>

                <div className="mt-3 border-t border-white/10 pt-3">
                  <SectionLabel>Snapshot History</SectionLabel>
                  <div className="mt-2.5 space-y-2">
                    {recentSaves.length ? (
                      recentSaves.map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
                        >
                          <div>
                            <div className="text-sm font-medium text-white">
                              {formatShortDateCT(row.snapshot_ts)}
                            </div>
                            <div className="text-xs text-white/45">
                              {timeAgo(row.snapshot_ts)}
                            </div>
                          </div>
                          <div className="text-sm font-medium text-white">
                            {compactMoney(row.equity)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-white/50">No recent save history.</div>
                    )}
                  </div>
                </div>
              </Surface>
            </div>
          </div>

          <Surface className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionLabel>Monthly Performance</SectionLabel>
                <div className="mt-1 text-[2rem] font-semibold text-white">
                  Monthly Stats
                </div>
                <div className="mt-1 text-sm text-white/55">
                  Equity change by month for the current year.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                  {new Date().getFullYear()}
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                  {activeMonthsCount} active month{activeMonthsCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
              {monthlyStats.map((m) => {
                const monthFlat = isFlatish(m.delta ?? 0);

                return (
                  <div
                    key={m.label}
                    className={`rounded-xl border p-3 ${
                      m.delta === null ? "border-white/10 bg-black/20" : pnlBgClass(m.delta)
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                      {m.label}
                    </div>

                    {m.delta === null ? (
                      <>
                        <div className="mt-2 text-sm font-medium text-white/70">No data</div>
                        <div className="mt-1 text-xs text-white/38">No saved snapshots yet</div>
                      </>
                    ) : (
                      <>
                        <div
                          className={`mt-2 font-semibold ${
                            monthFlat ? "text-base text-white" : `text-lg ${pnlTextClass(m.delta)}`
                          }`}
                        >
                          {deltaHeadline(m.delta, "Steady")}
                        </div>
                        <div className={`mt-1 text-xs ${pnlTextClass(m.delta)}`}>
                          {deltaSupport(m.delta, m.pct)}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Surface>

          <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
            <AccountPanel
              title="Live Account"
              subtitle="Saved live-account snapshot from the source dashboard."
              badge="Live"
              badgeClass="border-emerald-400/20 bg-emerald-500/12 text-emerald-300"
              equity={latest.live_equity}
              realized={latest.live_realized_pl}
              open={latest.live_open_pl}
              total={latest.live_total_pl}
              cash={latest.live_cash}
              realizedPct={latest.live_realized_pct}
              openPct={latest.live_open_pct}
              totalPct={latest.live_total_pct}
            />

            <AccountPanel
              title="Test Account"
              subtitle="Saved shadow-account snapshot for comparison."
              badge="Test"
              badgeClass="border-cyan-400/20 bg-cyan-500/12 text-cyan-300"
              equity={latest.test_equity}
              realized={latest.test_realized_pl}
              open={latest.test_open_pl}
              total={latest.test_total_pl}
              cash={latest.test_cash}
              realizedPct={latest.test_realized_pct}
              openPct={latest.test_open_pct}
              totalPct={latest.test_total_pct}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,18,25,0.75),rgba(8,10,15,0.9))] px-4 py-3 text-xs text-white/50">
            Overview is built from saved snapshots, not a live stream. Use the Live page for real-time monitoring and active position movement.
          </div>
        </>
      )}
    </div>
  );
}
