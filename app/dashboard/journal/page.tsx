"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  formatPercent,
  toNumber,
  type TradeJournalOverviewRow,
  type TradeJournalSummary,
} from "@/lib/tradeJournal";

type RangeKey = "7d" | "30d" | "90d" | "1y";
type AccountKey = "all" | "live" | "test";

type JournalPayload = {
  ok: boolean;
  range?: string;
  account?: string;
  summary?: TradeJournalSummary;
  rows?: TradeJournalOverviewRow[];
  error?: string;
};

type ImportPayload = {
  ok: boolean;
  imported?: number;
  skipped?: number;
  message?: string;
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function tone(value: number) {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-red-300";
  return "text-white";
}

function Card({
  title,
  value,
  sub,
  valueClass = "text-white",
}: {
  title: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
        {title}
      </div>
      <div className={`mt-3 text-3xl font-semibold ${valueClass}`}>{value}</div>
      {sub ? <div className="mt-2 text-sm text-white/50">{sub}</div> : null}
    </div>
  );
}

export default function JournalPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [account, setAccount] = useState<AccountKey>("all");
  const [payload, setPayload] = useState<JournalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/journal?range=${range}&account=${account}`, {
          cache: "no-store",
        });

        const json: JournalPayload = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load trade journal");
        }

        if (!cancelled) {
          setPayload(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load trade journal");
          setPayload(null);
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
  }, [range, account]);

  const rows = useMemo(() => payload?.rows ?? [], [payload]);
  const summary = payload?.summary;

  const bestTrade = useMemo(() => {
    if (!rows.length) return null;
    return [...rows].sort((a, b) => toNumber(b.net_pl) - toNumber(a.net_pl))[0];
  }, [rows]);

  async function importTradeHistory() {
    try {
      setImporting(true);
      setImportMessage("");
      setError("");

      const res = await fetch("/api/journal/import", {
        method: "POST",
        cache: "no-store",
      });

      const json: ImportPayload = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to import trade history");
      }

      setImportMessage(
        json.message ||
          `Imported ${json.imported ?? 0} trade${json.imported === 1 ? "" : "s"} into the journal.`,
      );

      const refreshRes = await fetch(`/api/journal?range=${range}&account=${account}`, {
        cache: "no-store",
      });
      const refreshJson: JournalPayload = await refreshRes.json();
      if (!refreshRes.ok || !refreshJson.ok) {
        throw new Error(refreshJson.error || "Imported trades but failed to refresh the journal");
      }

      setPayload(refreshJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import trade history");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-amber-300">
              Trade Journal
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Journal
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/60 md:text-[15px]">
              This is the TradeZella-replacement foundation: closed trades, playbook setup tracking,
              notes, tags, and review metrics. Once the new Supabase migration is applied, this page
              becomes the home for your full trade journal workflow.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void importTradeHistory()}
              disabled={importing}
              className="rounded-2xl border border-emerald-400/20 bg-emerald-500/12 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing ? "Importing..." : "Import Existing Trades"}
            </button>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-1">
              {(["7d", "30d", "90d", "1y"] as RangeKey[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setRange(value)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    range === value
                      ? "bg-amber-400 text-black"
                      : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-1">
              {(["all", "live", "test"] as AccountKey[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setAccount(value)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
                    account === value
                      ? "bg-cyan-400 text-black"
                      : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/8 p-5 text-red-200">
          {error}
        </div>
      ) : null}

      {importMessage ? (
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/8 p-5 text-emerald-200">
          {importMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card title="Trades" value={String(summary?.trades ?? 0)} sub="Closed journal trades in range" />
        <Card
          title="Net P/L"
          value={formatMoney(summary?.netPl ?? 0)}
          valueClass={tone(summary?.netPl ?? 0)}
          sub="Net after fees"
        />
        <Card title="Win Rate" value={formatPercent(summary?.winRate ?? 0)} sub="Winning trade percentage" />
        <Card
          title="Avg Winner"
          value={formatMoney(summary?.avgWinner ?? 0)}
          valueClass="text-emerald-300"
          sub={`${summary?.winners ?? 0} winners`}
        />
        <Card
          title="Avg Loser"
          value={formatMoney(summary?.avgLoser ?? 0)}
          valueClass="text-red-300"
          sub={`${summary?.losers ?? 0} losers`}
        />
      </div>

      <section className="rounded-[28px] border border-white/10 bg-black/30 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
              Recent Trades
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Trade review queue</h2>
          </div>
          <div className="text-sm text-white/45">
            Best trade in range:{" "}
            <span className="text-white/80">
              {bestTrade ? `${bestTrade.display_symbol ?? bestTrade.symbol} ${formatMoney(bestTrade.net_pl)}` : "-"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-white/60">
            Loading trade journal...
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-white/60">
            No journal trades found yet. Apply the Supabase migration, then either import your existing
            `trade_history` into `trade_journal_trades` with the button above, or start logging manual trade reviews.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-3">Closed</th>
                  <th className="px-3 py-3">Symbol</th>
                  <th className="px-3 py-3">Account</th>
                  <th className="px-3 py-3">Setup</th>
                  <th className="px-3 py-3">Net P/L</th>
                  <th className="px-3 py-3">Return</th>
                  <th className="px-3 py-3">Tags</th>
                  <th className="px-3 py-3">Review</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/6">
                    <td className="px-3 py-3 text-white/70">{formatDate(row.closed_at)}</td>
                    <td className="px-3 py-3 font-medium text-white">
                      {row.display_symbol ?? row.symbol ?? "-"}
                    </td>
                    <td className="px-3 py-3 uppercase text-white/65">{row.account ?? "-"}</td>
                    <td className="px-3 py-3 text-white/65">{row.setup_name ?? row.strategy ?? "-"}</td>
                    <td className={`px-3 py-3 font-medium ${tone(toNumber(row.net_pl))}`}>
                      {formatMoney(row.net_pl)}
                    </td>
                    <td className="px-3 py-3 text-white/65">{formatPercent(row.return_pct ?? 0)}</td>
                    <td className="px-3 py-3 text-white/55">{row.tags || "-"}</td>
                    <td className="max-w-[360px] px-3 py-3 text-white/55">
                      {row.latest_note || "No note yet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
