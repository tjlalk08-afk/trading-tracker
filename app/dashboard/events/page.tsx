"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type EventType =
  | "signal_received"
  | "signal_dispatched"
  | "entry_decision"
  | "test_pending_created"
  | "test_pending_update"
  | "order_submitted"
  | "order_result"
  | "position_opened"
  | "position_snapshot"
  | "position_action"
  | "exit_decision"
  | "trade_closed"
  | "reconciliation_check"
  | "risk_state"
  | "optimizer_run";

type ModeFilter = "all" | "live" | "paper" | "test";

type TradeEventRow = {
  id: number;
  event_id: string;
  event_time_utc: string;
  event_type: EventType;
  symbol: string;
  underlying_symbol?: string | null;
  signal_id?: string | null;
  trade_id?: string | null;
  parent_event_id?: string | null;
  mode: string;
  is_test: boolean;
  strategy?: string | null;
  engine?: string | null;
  side?: string | null;
  source: string;
  notes?: string | null;
  payload?: Record<string, unknown> | null;
  producer?: string | null;
  schema_version?: string | null;
  received_at: string;
};

type TradeEventsPayload = {
  ok: boolean;
  data?: TradeEventRow[];
  error?: string;
};

const EVENT_TYPE_OPTIONS: Array<{ value: "all" | EventType; label: string }> = [
  { value: "all", label: "All Events" },
  { value: "signal_received", label: "Signal Received" },
  { value: "entry_decision", label: "Entry Decision" },
  { value: "order_result", label: "Order Result" },
  { value: "position_opened", label: "Position Opened" },
  { value: "position_action", label: "Position Action" },
  { value: "trade_closed", label: "Trade Closed" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

function timeAgo(value: string | null | undefined) {
  if (!value) return "--";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return "--";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">{children}</div>;
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <Surface className="p-3.5">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-2 text-[1.6rem] font-semibold text-white">{value}</div>
      <div className="mt-1.5 text-sm text-white/55">{sub}</div>
    </Surface>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-2 text-xs font-medium transition",
        active
          ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-300"
          : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function eventTypeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function eventTone(value: string) {
  if (value === "trade_closed") return "text-cyan-300 border-cyan-400/20 bg-cyan-500/10";
  if (value === "entry_decision") return "text-amber-300 border-amber-400/20 bg-amber-500/10";
  if (value === "position_action") return "text-emerald-300 border-emerald-400/20 bg-emerald-500/10";
  if (value === "signal_received") return "text-white/80 border-white/10 bg-white/[0.04]";
  return "text-white/75 border-white/10 bg-white/[0.04]";
}

export default function EventsPage() {
  const [rows, setRows] = useState<TradeEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<"all" | EventType>("all");
  const [symbolFilter, setSymbolFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({ limit: "200" });
        if (modeFilter !== "all") params.set("mode", modeFilter);
        if (eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
        if (symbolFilter.trim()) params.set("symbol", symbolFilter.trim().toUpperCase());

        const res = await fetch(`/api/trade-events/query?${params.toString()}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as TradeEventsPayload;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load trade events.");
        }

        if (!cancelled) {
          setRows(json.data ?? []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load trade events.");
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [eventTypeFilter, modeFilter, symbolFilter]);

  const summary = useMemo(() => {
    const signals = rows.filter((row) => row.event_type === "signal_received").length;
    const decisions = rows.filter((row) => row.event_type === "entry_decision").length;
    const opened = rows.filter((row) => row.event_type === "position_opened").length;
    const closed = rows.filter((row) => row.event_type === "trade_closed").length;
    const uniqueSignals = new Set(rows.map((row) => row.signal_id).filter(Boolean)).size;

    return {
      total: rows.length,
      signals,
      decisions,
      opened,
      closed,
      uniqueSignals,
    };
  }, [rows]);

  const lastEvent = rows[0] ?? null;

  return (
    <div className="relative isolate space-y-2 overflow-hidden pt-1">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.08),transparent_30%)]" />

      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tight text-white xl:text-4xl">Events</h1>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
              Bot Trace Ledger
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              {summary.total} events loaded
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              Last event {lastEvent ? timeAgo(lastEvent.event_time_utc) : "--"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-wrap gap-2">
            {(["all", "live", "paper", "test"] as ModeFilter[]).map((value) => (
              <FilterButton key={value} active={modeFilter === value} onClick={() => setModeFilter(value)}>
                {value === "all" ? "All Modes" : value.toUpperCase()}
              </FilterButton>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/65">
            <span>Event</span>
            <select
              value={eventTypeFilter}
              onChange={(event) => setEventTypeFilter(event.target.value as "all" | EventType)}
              className="bg-transparent text-white outline-none"
            >
              {EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#0b1016] text-white">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <input
            value={symbolFilter}
            onChange={(event) => setSymbolFilter(event.target.value)}
            placeholder="Filter symbol"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>
      </div>

      {error ? (
        <Surface className="border-red-400/20 bg-red-500/10 p-4">
          <div className="text-sm text-red-300">{error}</div>
        </Surface>
      ) : null}

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <StatCard title="Signals" value={String(summary.signals)} sub="TradingView and forwarded signal rows" />
        <StatCard title="Entry Decisions" value={String(summary.decisions)} sub="Accepted, skipped, or deferred" />
        <StatCard title="Opened" value={String(summary.opened)} sub="Position-open rows received" />
        <StatCard title="Closed" value={String(summary.closed)} sub="Final trade close rows received" />
        <StatCard title="Signal IDs" value={String(summary.uniqueSignals)} sub="Unique traced signal lifecycles" />
      </div>

      <Surface className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3.5">
          <SectionLabel>Event Ledger</SectionLabel>
          <div className="mt-1 text-[1.55rem] font-semibold text-white">Recent Bot Events</div>
          <div className="mt-1 text-sm text-white/55">
            Click any row to inspect the full payload exactly as the bot sent it.
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-5 text-sm text-white/60">Loading event ledger...</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-5 text-sm text-white/60">
            No events found yet. Once your brother starts posting to the ingest endpoint, they will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/45">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Signal ID</th>
                  <th className="px-4 py-3 font-medium">Trade ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const expanded = expandedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className="cursor-pointer border-b border-white/8 text-white/85 transition hover:bg-white/[0.03]"
                        onClick={() => setExpandedId((current) => (current === row.id ? null : row.id))}
                      >
                        <td className="px-4 py-4">
                          <div className="font-medium text-white">{formatDate(row.event_time_utc)}</div>
                          <div className="mt-1 text-xs text-white/45">Received {timeAgo(row.received_at)}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${eventTone(
                              row.event_type,
                            )}`}
                          >
                            {eventTypeLabel(row.event_type)}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-medium">{row.symbol}</td>
                        <td className="px-4 py-4 uppercase text-white/65">{row.mode}</td>
                        <td className="px-4 py-4 text-white/70">{row.source}</td>
                        <td className="px-4 py-4 text-white/70">{row.signal_id ?? "--"}</td>
                        <td className="px-4 py-4 text-white/70">{row.trade_id ?? "--"}</td>
                      </tr>
                      {expanded ? (
                        <tr className="border-b border-white/8 bg-black/20">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid gap-3 xl:grid-cols-[0.85fr_1.15fr]">
                              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                                  Trace Summary
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-white/75">
                                  <div>Event ID: <span className="text-white">{row.event_id}</span></div>
                                  <div>Parent Event: <span className="text-white">{row.parent_event_id ?? "--"}</span></div>
                                  <div>Underlying: <span className="text-white">{row.underlying_symbol ?? "--"}</span></div>
                                  <div>Engine: <span className="text-white">{row.engine ?? "--"}</span></div>
                                  <div>Strategy: <span className="text-white">{row.strategy ?? "--"}</span></div>
                                  <div>Side: <span className="text-white">{row.side ?? "--"}</span></div>
                                  <div>Producer: <span className="text-white">{row.producer ?? "--"}</span></div>
                                  <div>Schema: <span className="text-white">{row.schema_version ?? "--"}</span></div>
                                  <div>Notes: <span className="text-white">{row.notes ?? "--"}</span></div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                                  Raw Payload
                                </div>
                                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-white/75">
                                  {JSON.stringify(row.payload ?? {}, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
