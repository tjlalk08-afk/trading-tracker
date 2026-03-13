"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  formatPercent,
  type TradeJournalDetailRow,
  type TradeJournalNoteRow,
  type TradeJournalScreenshotRow,
} from "@/lib/tradeJournal";

type TradeDetailPayload = {
  ok: boolean;
  trade?: TradeJournalDetailRow;
  notes?: TradeJournalNoteRow[];
  screenshots?: TradeJournalScreenshotRow[];
  error?: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function tone(value: number) {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-red-300";
  return "text-white";
}

function Metric({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <div className={`mt-2 text-lg font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function tradingViewUrl(symbol: string) {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`AMEX:${symbol}`)}`;
}

export default function JournalTradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [tradeId, setTradeId] = useState<string>("");
  const [payload, setPayload] = useState<TradeDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const resolved = await params;
      if (!cancelled) {
        setTradeId(resolved.id);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!tradeId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/journal/${tradeId}`, {
          cache: "no-store",
        });
        const json: TradeDetailPayload = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load trade detail");
        }

        if (!cancelled) {
          setPayload(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load trade detail");
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
  }, [tradeId]);

  const trade = payload?.trade;
  const notes = payload?.notes ?? [];
  const screenshots = payload?.screenshots ?? [];
  const symbol = useMemo(
    () => trade?.display_symbol ?? trade?.symbol ?? "SPY",
    [trade],
  );

  if (loading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-black/30 px-5 py-10 text-white/65">
        Loading trade detail...
      </div>
    );
  }

  if (error || !trade) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/journal" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← Back to journal
        </Link>
        <div className="rounded-[28px] border border-red-500/20 bg-red-500/8 px-5 py-6 text-red-200">
          {error || "Trade not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard/journal" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← Back to journal
        </Link>
        <a
          href={tradingViewUrl(symbol)}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-cyan-400/20 bg-cyan-500/12 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/18"
        >
          Open In TradingView
        </a>
      </div>

      <section className="rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-amber-300">
              Trade Detail
            </div>
            <h1 className="mt-4 text-4xl font-semibold text-white">
              {trade.display_symbol ?? trade.symbol ?? "Trade"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
              This is where the journal becomes more than a summary table. You can review when the trade
              happened, what account it came from, how it performed, and tie that back to chart context.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/65">
            Imported source: <span className="text-white/85">{trade.source ?? "-"}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Metric label="Account" value={(trade.account ?? "-").toUpperCase()} />
        <Metric label="Side" value={trade.side ?? "-"} />
        <Metric label="Entry" value={formatMoney(trade.entry_price)} />
        <Metric label="Exit" value={formatMoney(trade.exit_price)} />
        <Metric
          label="Net P/L"
          value={formatMoney(trade.net_pl)}
          valueClass={tone(Number(trade.net_pl ?? 0))}
        />
        <Metric label="Return" value={formatPercent(trade.return_pct ?? 0)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="xl:col-span-8 rounded-[28px] border border-white/10 bg-black/30 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                Chart Context
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Underlying chart</h2>
            </div>
            <div className="text-sm text-white/45">
              {formatDateTime(trade.opened_at)} → {formatDateTime(trade.closed_at)}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            We can show the symbol chart and the trade timing right now. To show the exact chart state you saw
            at entry and exit, the next step is saving screenshots or candle snapshots at trade time.
          </div>

          <div className="mt-4 h-[520px] overflow-hidden rounded-2xl border border-white/10 bg-black">
            <iframe
              title={`Chart for ${symbol}`}
              src={tradingViewUrl(symbol)}
              className="h-full w-full"
              style={{ border: 0 }}
            />
          </div>
        </section>

        <section className="xl:col-span-4 rounded-[28px] border border-white/10 bg-black/30 p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
            Trade Context
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white/75">
              Opened: {formatDateTime(trade.opened_at)}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white/75">
              Closed: {formatDateTime(trade.closed_at)}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white/75">
              Quantity: {trade.quantity ?? "-"}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white/75">
              Duration: {trade.duration_minutes ?? "-"} minutes
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white/75">
              Strategy / Setup: {trade.strategy ?? "-"}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white/75">
              Rules Followed: {trade.rules_followed === null ? "-" : trade.rules_followed ? "Yes" : "No"}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-[28px] border border-white/10 bg-black/30 p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
            Notes
          </div>
          {notes.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-white/55">
              No review note saved yet. Next step: we can add note editing directly on this page.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-sm font-medium text-white">
                    {note.title ?? note.note_type ?? "Note"}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/65">
                    {note.body ?? "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-black/30 p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
            Screenshots
          </div>
          {screenshots.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-white/55">
              No screenshots saved yet. If you want the journal to feel like TradeZella, the next big upgrade is
              attaching chart screenshots to each trade at review time.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3">
              {screenshots.map((shot) => (
                <a
                  key={shot.id}
                  href={shot.image_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-white/75 hover:bg-black/30"
                >
                  <div className="text-sm font-medium text-white">
                    {shot.caption ?? shot.shot_type ?? "Screenshot"}
                  </div>
                  <div className="mt-2 break-all text-xs text-white/50">
                    {shot.image_url ?? "-"}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
