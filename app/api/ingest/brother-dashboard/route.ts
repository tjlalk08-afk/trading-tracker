import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

type UpstreamTrade = {
  qty?: number | string | null;
  side?: string | null;
  symbol?: string | null;
  display_symbol?: string | null;
  entry_price?: number | string | null;
  exit_price?: number | string | null;
  realized_pnl?: number | string | null;
  realized_pl?: number | string | null;
  option_symbol?: string | null;
  trade_id?: string | null;
  closed_at?: string | null;
  entry_time?: string | null;
  is_test?: boolean | null;
};

type TradeHistoryInsert = {
  snapshot_date: string;
  trade_day: string;
  symbol: string;
  side: string | null;
  qty: number | null;
  entry_price: number | null;
  exit_price: number | null;
  realized_pl: number | null;
  opened_at: string | null;
  closed_at: string;
  source: string;
  external_trade_id: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function toStringValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

function toNumberValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\(/g, "-")
    .replace(/\)/g, "")
    .trim();

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeTimestamp(value: unknown): string | null {
  const raw = toStringValue(value);
  if (!raw) return null;

  // Handles values like "2026-03-10 08:35:46"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.replace(" ", "T");
  }

  // Handles ISO-ish values directly
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function resolveBotDashboardUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");

  if (trimmed.endsWith("/api/bot/dashboard")) return trimmed;
  if (trimmed.endsWith("/bot/dashboard")) return `${trimmed.replace(/\/bot\/dashboard$/, "")}/api/bot/dashboard`;
  if (trimmed.endsWith("/api/dashboard")) return trimmed;

  return `${trimmed}/api/bot/dashboard`;
}

async function fetchBrotherDashboardPayload(): Promise<JsonRecord> {
  const raw = process.env.BOT_DASHBOARD_URL?.trim();

  if (!raw) {
    throw new Error("BOT_DASHBOARD_URL is missing");
  }

  const url = resolveBotDashboardUrl(raw);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Brother dashboard fetch failed (${response.status})`);
  }

  const json = await response.json();

  if (!isRecord(json)) {
    throw new Error("Brother dashboard payload was not an object");
  }

  return json;
}

function buildSnapshotRow(upstream: JsonRecord) {
  const payload = asRecord(upstream.data);

  const snapshotTs =
    normalizeTimestamp(upstream.ts) ??
    normalizeTimestamp(upstream.snapshot_ts) ??
    new Date().toISOString();

  const updatedText =
    toStringValue(payload.updated) ??
    toStringValue(upstream.updated_text) ??
    null;

  const liveCash = toNumberValue(payload.live_cash) ?? 0;
  const liveRealized = toNumberValue(payload.live_realized_pl) ?? 0;
  const liveOpen = toNumberValue(payload.live_open_pl) ?? 0;
  const liveTotal = toNumberValue(payload.live_total_pl) ?? 0;
  const liveEquity = toNumberValue(payload.live_equity) ?? 0;

  const testCash = toNumberValue(payload.test_cash) ?? 0;
  const testRealized = toNumberValue(payload.test_realized_pl) ?? 0;
  const testOpen = toNumberValue(payload.test_open_pl) ?? 0;
  const testTotal = toNumberValue(payload.test_total_pl) ?? 0;
  const testEquity = toNumberValue(payload.test_equity) ?? 0;

  const cash = toNumberValue(payload.cash) ?? liveCash;
  const realizedPl =
    toNumberValue(payload.realized_pl) ??
    liveRealized + testRealized;
  const openPl =
    toNumberValue(payload.open_pl) ??
    liveOpen + testOpen;
  const totalPl =
    toNumberValue(payload.total_pl) ??
    liveTotal + testTotal;
  const equity =
    toNumberValue(payload.equity) ??
    liveEquity + testEquity;

  return {
    snapshotTs,
    snapshotDate: dateOnly(snapshotTs),
    row: {
      source: "brother_dashboard",
      snapshot_ts: snapshotTs,
      updated_text: updatedText,

      cash,
      realized_pl: realizedPl,
      open_pl: openPl,
      total_pl: totalPl,
      equity,

      live_cash: liveCash,
      live_realized_pl: liveRealized,
      live_open_pl: liveOpen,
      live_total_pl: liveTotal,
      live_equity: liveEquity,

      test_cash: testCash,
      test_realized_pl: testRealized,
      test_open_pl: testOpen,
      test_total_pl: testTotal,
      test_equity: testEquity,

      raw_payload: upstream,
    },
  };
}

function normalizeTrade(
  rawTrade: unknown,
  mode: "live" | "test",
  snapshotDate: string,
): TradeHistoryInsert | null {
  if (!isRecord(rawTrade)) return null;

  const trade = rawTrade as UpstreamTrade;

  // Prefer display_symbol so test rows like SPY_TEST still roll up under SPY
  const symbol =
    toStringValue(trade.display_symbol) ??
    toStringValue(trade.symbol);

  const closedAt = normalizeTimestamp(trade.closed_at);
  if (!symbol || !closedAt) return null;

  const source = mode === "live" ? "brother_live" : "brother_test";
  const optionSymbol = toStringValue(trade.option_symbol) ?? "";
  const side = toStringValue(trade.side);
  const qty = toNumberValue(trade.qty);
  const entryPrice = toNumberValue(trade.entry_price);
  const exitPrice = toNumberValue(trade.exit_price);
  const realizedPl =
    toNumberValue(trade.realized_pnl) ??
    toNumberValue(trade.realized_pl);
  const openedAt = normalizeTimestamp(trade.entry_time);
  const externalTradeId =
    toStringValue(trade.trade_id) ??
    [
      source,
      closedAt,
      symbol,
      optionSymbol,
      side ?? "",
      qty ?? "",
      entryPrice ?? "",
      exitPrice ?? "",
      realizedPl ?? "",
    ].join("|");

  return {
    snapshot_date: snapshotDate,
    trade_day: dateOnly(closedAt),
    symbol,
    side,
    qty,
    entry_price: entryPrice,
    exit_price: exitPrice,
    realized_pl: realizedPl,
    opened_at: openedAt,
    closed_at: closedAt,
    source,
    external_trade_id: externalTradeId,
  };
}

function extractCompletedTrades(
  upstream: JsonRecord,
  snapshotDate: string,
): TradeHistoryInsert[] {
  const payload = asRecord(upstream.data);

  const liveRaw = Array.isArray(payload.closed_trades_live)
    ? payload.closed_trades_live
    : [];

  const testRaw = Array.isArray(payload.closed_trades_test)
    ? payload.closed_trades_test
    : [];

  const normalized = [
    ...liveRaw.map((trade) => normalizeTrade(trade, "live", snapshotDate)),
    ...testRaw.map((trade) => normalizeTrade(trade, "test", snapshotDate)),
  ].filter((trade): trade is TradeHistoryInsert => trade !== null);

  const deduped = new Map<string, TradeHistoryInsert>();
  for (const trade of normalized) {
    deduped.set(trade.external_trade_id, trade);
  }

  return Array.from(deduped.values());
}

async function handleIngest() {
  const supabaseAdmin = getSupabaseAdmin();
  const upstream = await fetchBrotherDashboardPayload();

  const snapshot = buildSnapshotRow(upstream);

  const { data: insertedSnapshot, error: snapshotError } = await supabaseAdmin
    .from("dashboard_snapshots")
    .insert(snapshot.row as never)
    .select()
    .single();

  if (snapshotError) {
    throw new Error(`Snapshot insert failed: ${snapshotError.message}`);
  }

  const trades = extractCompletedTrades(upstream, snapshot.snapshotDate);

  let upsertedTrades = 0;

  if (trades.length > 0) {
    const { error: tradeError } = await supabaseAdmin
      .from("trade_history")
      .upsert(trades as never, {
        onConflict: "external_trade_id",
      });

    if (tradeError) {
      throw new Error(`Trade history upsert failed: ${tradeError.message}`);
    }

    upsertedTrades = trades.length;
  }

  return NextResponse.json({
    ok: true,
    message: "Snapshot saved and trades ingested",
    snapshot_id: insertedSnapshot?.id ?? null,
    snapshot_ts: snapshot.snapshotTs,
    completed_trades_found: trades.length,
    completed_trades_upserted: upsertedTrades,
    data: insertedSnapshot,
  });
}

export async function GET() {
  try {
    return await handleIngest();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown ingest error";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    return await handleIngest();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown ingest error";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
