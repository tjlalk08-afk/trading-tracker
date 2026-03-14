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

function metricHeadline(n: number | null | undefined) {
  return isFlatish(n) ? money(0) : signedMoney(n);
}

function metricSupport(n: number | null | undefined, pct?: number | null) {
  return isFlatish(n) ? "No movement" : signedPct(pct);
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
  return "text-slate-100";
}

function pnlBgClass(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (n > 0) return "border-emerald-400/15 bg-emerald-500/[0.07]";
  if (n < 0) return "border-red-400/15 bg-red-500/[0.07]";
  return "border-slate-700/40 bg-slate-950/45";
}

function freshnessState(dateStr: string | null | undefined) {
  const mins = ageMinutes(dateStr);

  if (mins === null) {
    return {
      label: "Unknown",
      detail: "Snapshot timing unavailable",
      badgeClass: "border-slate-700/40 bg-slate-900/55 text-slate-300",
    };
  }

  if (mins <= 15) {
    return {
      label: "Fresh",
      detail: "Recently saved snapshot",
      badgeClass:
        "border-[rgba(60,163,123,0.24)] bg-[rgba(60,163,123,0.08)] text-[var(--accent-strong)]",
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
        "relative overflow-hidden rounded-2xl border border-slate-700/40",
        "bg-[linear-gradient(180deg,rgba(22,31,43,0.96),rgba(12,18,27,0.98))]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_10px_24px_rgba(0,0,0,0.26)]",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(60,163,123,0.08),transparent_24%),radial-gradient(circle_at_top_right,rgba(71,85,105,0.09),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent_32%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
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
    <Surface className="p-2.5">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{title}</SectionLabel>
        <div
          className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.14em] sm:px-2.5 sm:text-[10px] sm:tracking-[0.16em] ${
            flat
              ? "border-slate-700/40 bg-slate-900/55 text-slate-400"
              : delta > 0
              ? "border-[rgba(60,163,123,0.24)] bg-[rgba(60,163,123,0.1)] text-[var(--accent-strong)]"
              : "border-red-400/20 bg-red-500/12 text-red-300"
          }`}
        >
          {descriptor.label}
        </div>
      </div>

      <div
        className={`mt-2 font-semibold leading-none ${pnlTextClass(delta)} ${
          flat ? "text-[1.05rem] sm:text-[1.2rem]" : "text-[1.2rem] sm:text-[1.45rem]"
        }`}
      >
        {deltaHeadline(delta, "Steady")}
      </div>

      <div className={`mt-1 text-[11px] font-medium sm:mt-1.5 sm:text-xs ${pnlTextClass(delta)}`}>
        {deltaSupport(delta, pct)}
      </div>

      <div className="mt-1 text-[10px] text-slate-400 sm:text-[11px]">{descriptor.sentence}</div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] sm:mt-2 sm:text-[11px]">
        <div className="rounded-lg border border-slate-700/40 bg-slate-950/45 px-2 py-1.5 sm:px-2.5 sm:py-2">
          <div className="uppercase tracking-[0.16em] text-slate-500">Start</div>
          <div className="font-mono-metric mt-1 font-medium text-slate-200">{compactMoney(startEquity)}</div>
        </div>
        <div className="rounded-lg border border-slate-700/40 bg-slate-950/45 px-2 py-1.5 sm:px-2.5 sm:py-2">
          <div className="uppercase tracking-[0.16em] text-slate-500">Now</div>
          <div className="font-mono-metric mt-1 font-medium text-slate-200">{compactMoney(endEquity)}</div>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-slate-500 sm:text-[11px]">Since {startLabel}</div>
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
    <Surface className="h-full p-2.5">
      <div className="mb-2.5 flex items-center gap-2 sm:mb-3">
        <div className="h-[2px] w-8 rounded-full bg-[rgba(60,163,123,0.9)]" />
        <div className="h-[2px] w-3 rounded-full bg-slate-500/70" />
      </div>

      <SectionLabel>{title}</SectionLabel>

      <div className={`font-mono-metric mt-1.5 text-base font-semibold sm:mt-2 sm:text-[1.15rem] ${tone}`}>{value}</div>

      {sub ? <div className="mt-1.5 text-[11px] text-slate-400 sm:mt-2 sm:text-xs">{sub}</div> : null}
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
    <Surface className="h-full p-2.5">
      <div className="mb-2.5 flex items-center gap-2 sm:mb-3">
        <div className="h-[2px] w-8 rounded-full bg-[rgba(60,163,123,0.9)]" />
        <div className="h-[2px] w-3 rounded-full bg-slate-500/70" />
      </div>

      <SectionLabel>Snapshot Status</SectionLabel>

      <div className="font-mono-metric mt-1.5 text-base font-semibold text-slate-100 sm:mt-2 sm:text-[1.15rem]">{money(equity)}</div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div
          className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.14em] sm:px-2.5 sm:text-[10px] sm:tracking-[0.18em] ${freshness.badgeClass}`}
        >
          {freshness.label}
        </div>
        <div className="rounded-full border border-slate-700/40 bg-slate-900/55 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-slate-400 sm:px-2.5 sm:text-[10px] sm:tracking-[0.18em]">
          Saved Snapshot
        </div>
      </div>

      <div className="mt-2 text-[11px] text-slate-400 sm:text-xs">{freshness.detail}</div>

      <div className="mt-2 space-y-1 text-[11px] text-slate-400 sm:mt-2.5 sm:text-xs">
        <div>
          Last saved: <span className="font-medium text-slate-200">{snapshotAge}</span>
        </div>
        <div>
          Source updated:{" "}
          <span className="font-medium text-slate-200">{formatDateTimeCT(updatedAt)}</span>
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
    <div className="rounded-xl border border-slate-700/40 bg-slate-950/45 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className={`font-mono-metric mt-1 text-[15px] font-semibold sm:mt-1.5 sm:text-base ${tone}`}>{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-slate-400 sm:text-xs">{sub}</div> : null}
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
    <div className="rounded-xl border border-slate-700/40 bg-slate-950/45 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-1 text-[13px] font-semibold sm:mt-1.5 sm:text-sm ${tone}`}>{value}</div>
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
    <Surface className="p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Account
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-100 sm:mt-1.5 sm:text-[1.3rem]">{title}</div>
          <div className="mt-1 text-xs text-slate-400 sm:text-sm">{subtitle}</div>
        </div>

        <div
          className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] sm:px-3 sm:text-[10px] sm:tracking-[0.18em] ${badgeClass}`}
        >
          {badge}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-2.5 xl:grid-cols-5">
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
    <div className="flex items-center justify-between gap-4 border-b border-slate-700/30 py-2 last:border-b-0">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`text-right text-sm font-medium ${valueClass}`}>{value}</div>
    </div>
  );
}

function CompactHealthPill({
  label,
  check,
}: {
  label: string;
  check: HealthCheck | undefined;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${healthTone(check?.status)}`}>
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${healthDot(check?.status)}`} />
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">{label}</div>
      </div>
      <div className="mt-1 text-[12px] font-medium leading-5">
        {check?.message ?? "Unavailable"}
      </div>
    </div>
  );
}

function healthTone(status: "ok" | "warn" | "error" | undefined) {
  if (status === "ok") {
    return "border-[rgba(60,163,123,0.18)] bg-[rgba(60,163,123,0.08)] text-[var(--accent-strong)]";
  }

  if (status === "warn") {
    return "border-amber-400/20 bg-amber-500/10 text-amber-300";
  }

  return "border-red-400/20 bg-red-500/10 text-red-300";
}

function healthDot(status: "ok" | "warn" | "error" | undefined) {
  if (status === "ok") return "bg-[var(--accent)]";
  if (status === "warn") return "bg-amber-400";
  return "bg-red-400";
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
          ? "border-[rgba(60,163,123,0.24)] bg-[rgba(60,163,123,0.1)] text-[var(--accent-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          : "border-slate-700/40 bg-slate-900/55 text-slate-400 hover:bg-slate-800/80 hover:text-slate-100",
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
    <div className="rounded-xl border border-slate-700/40 bg-slate-950/45 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`font-mono-metric mt-1 text-sm font-medium ${tone}`}>{value}</div>
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
  const height = 220;
  const padLeft = 22;
  const padRight = 16;
  const padTop = 12;
  const padBottom = 20;

  if (rows.length < 2) {
    return (
      <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
        <div className="text-sm font-medium text-slate-300">More snapshot history needed</div>
        <div className="max-w-md text-sm text-slate-400">
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
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
        <defs>
          <linearGradient id="equityAreaStrong" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(60,163,123,0.30)" />
            <stop offset="55%" stopColor="rgba(60,163,123,0.10)" />
            <stop offset="100%" stopColor="rgba(71,85,105,0.02)" />
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
            stroke="rgba(60,163,123,0.26)"
            strokeWidth="10"
            filter="url(#glow)"
          />
        ) : null}

        <polyline fill="url(#equityAreaStrong)" stroke="none" points={area} />
        <polyline
          fill="none"
          stroke="rgba(60,163,123,0.98)"
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
              fill={hoveredIndex === idx ? "rgba(143,214,183,1)" : "rgba(60,163,123,0.92)"}
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
          <div className="rounded-xl border border-slate-700/40 bg-[#0f1620]/92 px-4 py-2.5 text-sm text-slate-300 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            Equity held steady across this saved range.
          </div>
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute top-3 -translate-x-1/2 rounded-xl border border-slate-700/40 bg-[#0f1620]/95 px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        style={{ left: hoverLeft }}
      >
        <div className="font-mono-metric font-medium text-slate-100">{money(hoverPoint.value)}</div>
        <div className="mt-1 text-slate-400">{formatDateTimeCT(hoverPoint.ts)}</div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
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

  const healthSummary = useMemo(() => {
    const checks = [
      health?.checks?.config,
      health?.checks?.bot,
      health?.checks?.supabase,
      health?.checks?.snapshot,
      health?.checks?.trades,
      health?.checks?.cron,
    ];

    return checks.reduce(
      (acc, check) => {
        if (check?.status === "ok") acc.ok += 1;
        else if (check?.status === "warn") acc.warn += 1;
        else acc.error += 1;
        return acc;
      },
      { ok: 0, warn: 0, error: 0 }
    );
  }, [health]);

  return (
    <div className="relative isolate space-y-1.5 overflow-hidden pt-0.5">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[300px] bg-[radial-gradient(circle_at_10%_0%,rgba(60,163,123,0.10),transparent_22%),radial-gradient(circle_at_90%_0%,rgba(71,85,105,0.14),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(30,41,59,0.10),transparent_28%)]" />

      <div className="flex flex-col gap-1.5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-slate-100 sm:text-[2rem]">Overview</h1>

            <div className="rounded-full border border-slate-700/40 bg-slate-900/55 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Saved Snapshot
            </div>

            <div
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${freshness.badgeClass}`}
            >
              {freshness.label}
            </div>
          </div>

          <div className="mt-1 max-w-3xl text-[13px] text-slate-400 sm:text-sm">
            High-level account view for saved performance, trend direction, and live-versus-test comparison.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/55 px-3 py-2 text-xs text-slate-400 sm:px-3.5">
            Last saved: <span className="font-medium text-slate-100">{snapshotAge}</span>
          </div>

          <button
            onClick={() => void refreshSnapshot()}
            disabled={refreshing}
            className="rounded-xl border border-[rgba(60,163,123,0.24)] bg-[rgba(60,163,123,0.1)] px-3 py-2 text-xs font-medium text-[var(--accent-strong)] transition hover:bg-[rgba(60,163,123,0.16)] disabled:cursor-not-allowed disabled:opacity-60 sm:px-3.5"
          >
            {refreshing ? "Refreshing..." : "Reload Snapshot"}
          </button>

          <Link
            href="/dashboard/live"
            className="rounded-xl border border-slate-700/40 bg-slate-900/55 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800/75 sm:px-3.5"
          >
            Live
          </Link>

          <Link
            href="/dashboard/performance"
            className="rounded-xl border border-slate-700/40 bg-slate-900/55 px-3 py-2 text-xs text-slate-300 transition hover:bg-slate-800/75 sm:px-3.5"
          >
            Performance
          </Link>
        </div>
      </div>

      {error ? (
        <Surface className="border-red-400/20 bg-red-500/10 p-3">
          <div className="text-sm text-red-300">{error}</div>
        </Surface>
      ) : null}

      {loading ? (
        <Surface className="p-5">
          <div className="text-sm text-slate-400">Loading dashboard...</div>
        </Surface>
      ) : !hasSnapshot ? (
        <Surface className="p-5">
          <div className="text-xl font-semibold text-slate-100">No snapshot saved yet</div>
          <div className="mt-2 text-sm text-slate-400">
            Pull the first snapshot from your dashboard source and the overview will populate automatically.
          </div>
        </Surface>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
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

          <div className="grid grid-cols-1 gap-1.5">
            <div>
              <div className="space-y-1.5">
                <Surface className="p-2.5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <SectionLabel>Runtime Health</SectionLabel>
                      <div className="mt-1 text-[1.1rem] font-semibold text-slate-100 sm:text-[1.2rem]">
                        {healthSummary.ok} healthy, {healthSummary.warn} warning, {healthSummary.error} issue
                        {healthSummary.error === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-700/40 bg-slate-900/55 px-3 py-2 text-xs text-slate-400">
                      Checked: <span className="text-slate-200">{timeAgo(health?.checked_at)}</span>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5 xl:grid-cols-6">
                    <CompactHealthPill label="Config" check={health?.checks?.config} />
                    <CompactHealthPill label="Bot" check={health?.checks?.bot} />
                    <CompactHealthPill label="Supabase" check={health?.checks?.supabase} />
                    <CompactHealthPill label="Snapshots" check={health?.checks?.snapshot} />
                    <CompactHealthPill label="Trades" check={health?.checks?.trades} />
                    <CompactHealthPill label="Cron" check={health?.checks?.cron} />
                  </div>
                </Surface>

                <Surface className="p-2.5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <SectionLabel>Performance</SectionLabel>
                      <div className="mt-1 text-[1.4rem] font-semibold text-slate-100 sm:text-[1.6rem]">
                        Account Balance
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
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

                  <div className="mt-2.5 grid grid-cols-2 gap-1.5 lg:grid-cols-5">
                    <ChartStat label="Current" value={money(chartSummary.latest)} />
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

                  <div className="mt-2.5 rounded-2xl border border-slate-700/40 bg-slate-950/45 p-2">
                    <EquityChart rows={chartRows} />
                  </div>
                </Surface>

                <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-3">
                  <TopCard
                    title="Today's Realized"
                    value={metricHeadline(latest.realized_pl)}
                    sub={summary?.realizedRead}
                    tone={pnlTextClass(latest.realized_pl)}
                  />
                  <TopCard
                    title="Open Exposure"
                    value={metricHeadline(latest.open_pl)}
                    sub={summary?.openRead}
                    tone={pnlTextClass(latest.open_pl)}
                  />
                  <TopCard
                    title="Today's Total"
                    value={metricHeadline(latest.total_pl)}
                    sub={metricSupport(latest.total_pl, latest.total_pct)}
                    tone={pnlTextClass(latest.total_pl)}
                  />
                </div>
              </div>
            </div>

            <div className="hidden">
              <Surface className="h-full p-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SectionLabel>Summary</SectionLabel>
                    <div className="mt-1 text-[1.4rem] font-semibold text-slate-100 sm:text-[1.6rem]">
                      Snapshot Brief
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      Quick read on freshness, direction, and account comparison.
                    </div>
                  </div>

                  <div
                    className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${freshness.badgeClass}`}
                  >
                    {freshness.label}
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <BriefStat label="Status" value={freshness.label} tone={pnlTextClass(0)} />
                  <BriefStat
                    label="Leader"
                    value={summary?.leader ?? "—"}
                    tone={pnlTextClass(summary?.totalGap ?? 0)}
                  />
                  <BriefStat label="Range" value={chartRange === "ALL" ? "All" : chartRange} />
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

                <div className="mt-3 border-t border-slate-700/40 pt-3">
                  <SectionLabel>Snapshot History</SectionLabel>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    {recentSaves.length ? (
                      recentSaves.map((row) => (
                        <div
                          key={row.id}
                          className="rounded-xl border border-slate-700/40 bg-slate-950/45 px-3 py-2.5"
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-100">
                              {formatShortDateCT(row.snapshot_ts)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {timeAgo(row.snapshot_ts)}
                            </div>
                          </div>
                          <div className="font-mono-metric mt-2 text-sm font-medium text-slate-100">
                            {compactMoney(row.equity)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-400">No recent save history.</div>
                    )}
                  </div>
                </div>
              </Surface>
            </div>
          </div>

          <Surface className="p-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionLabel>Monthly Performance</SectionLabel>
                <div className="mt-1 text-[1.45rem] font-semibold text-slate-100">
                  Monthly Stats
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  Equity change by month for the current year.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-slate-700/40 bg-slate-900/55 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  {new Date().getFullYear()}
                </div>
                <div className="rounded-full border border-slate-700/40 bg-slate-900/55 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  {activeMonthsCount} active month{activeMonthsCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-1.5 md:grid-cols-4 xl:grid-cols-6">
              {monthlyStats.map((m) => {
                const monthFlat = isFlatish(m.delta ?? 0);

                return (
                  <div
                    key={m.label}
                    className={`rounded-xl border p-3 ${
                      m.delta === null ? "border-slate-700/40 bg-slate-950/45" : pnlBgClass(m.delta)
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      {m.label}
                    </div>

                    {m.delta === null ? (
                      <>
                        <div className="mt-2 text-sm font-medium text-slate-300">No data</div>
                        <div className="mt-1 text-xs text-slate-500">No saved snapshots yet</div>
                      </>
                    ) : (
                      <>
                        <div
                          className={`mt-2 font-semibold ${
                            monthFlat ? "font-mono-metric text-base text-slate-100" : `font-mono-metric text-lg ${pnlTextClass(m.delta)}`
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

          <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2">
            <AccountPanel
              title="Live Account"
              subtitle="Saved live-account snapshot from the source dashboard."
              badge="Live"
              badgeClass="border-[rgba(60,163,123,0.24)] bg-[rgba(60,163,123,0.1)] text-[var(--accent-strong)]"
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
              badgeClass="border-slate-700/40 bg-slate-900/55 text-slate-300"
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

          <div className="rounded-2xl border border-slate-700/40 bg-[linear-gradient(180deg,rgba(18,24,33,0.92),rgba(11,16,22,0.98))] px-4 py-2.5 text-xs text-slate-400">
            Overview is built from saved snapshots, not a live stream. Use the Live page for real-time monitoring and active position movement.
          </div>
        </>
      )}
    </div>
  );
}
