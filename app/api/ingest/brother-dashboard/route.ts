import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getBotDashboardUrl } from "@/lib/botDashboardUrl";
import { fetchJsonWithTimeout } from "@/lib/fetchJsonWithTimeout";
import { requireAdminApiUser } from "@/lib/requireAdminApiUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthorizedRequest = {
  applyCookies(response: NextResponse): NextResponse;
};

async function authorizeRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : "";

  if (process.env.CRON_SECRET && authHeader === expected) {
    return {
      auth: {
        applyCookies(response: NextResponse) {
          return response;
        },
      },
    };
  }

  const auth = await requireAdminApiUser(req);
  if ("error" in auth) {
    return { error: auth.error };
  }

  return {
    auth: {
      applyCookies(response: NextResponse) {
        return auth.applyCookies(response);
      },
    },
  };
}

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
  mode: "live" | "paper";
  external_trade_id: string;
};

type InsertedSnapshotRow = {
  id: number;
  snapshot_ts: string | null;
};

const BOT_SOURCE_TIMEZONE =
  process.env.BROTHER_BOT_SOURCE_TIMEZONE?.trim() || "America/New_York";

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

  // Handles ISO values that already include timezone information.
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) {
    return raw;
  }

  const localMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T])(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (localMatch) {
    const [, year, month, day, hour, minute, second = "00"] = localMatch;
    return localTimeToUtcIso(
      {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: Number(hour),
        minute: Number(minute),
        second: Number(second),
      },
      BOT_SOURCE_TIMEZONE,
    );
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

async function fetchBrotherDashboardPayload(): Promise<JsonRecord> {
  const url = getBotDashboardUrl();

  const json = await fetchJsonWithTimeout<JsonRecord>(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    timeoutMs: 20000,
  });

  if (!isRecord(json)) {
    throw new Error("Brother dashboard payload was not an object");
  }

  if (json.ok === false) {
    throw new Error("Brother dashboard reported failure");
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
  const directEquity = toNumberValue(payload.equity);
  const directCash = toNumberValue(payload.cash);
  const detectedMode: "live" | "paper" =
    directEquity === 10000 ||
    directCash === 10000 ||
    (liveEquity === 0 && testEquity === 10000)
      ? "paper"
      : "live";

  return {
    mode: detectedMode,
    snapshotTs,
    snapshotDate: dateOnly(snapshotTs),
    row: {
      mode: detectedMode,
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
  snapshotMode: "live" | "paper",
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
    mode: snapshotMode === "paper" ? "paper" : mode === "test" ? "paper" : "live",
    external_trade_id: externalTradeId,
  };
}

function extractCompletedTrades(
  upstream: JsonRecord,
  snapshotMode: "live" | "paper",
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
    ...liveRaw.map((trade) => normalizeTrade(trade, "live", snapshotMode, snapshotDate)),
    ...testRaw.map((trade) => normalizeTrade(trade, "test", snapshotMode, snapshotDate)),
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

  const savedSnapshot = insertedSnapshot as InsertedSnapshotRow | null;

  const trades = extractCompletedTrades(upstream, snapshot.mode, snapshot.snapshotDate);

  let upsertedTrades = 0;

  if (trades.length > 0) {
    const tradeHistoryRows = trades.map((trade) => ({
      snapshot_date: trade.snapshot_date,
      trade_day: trade.trade_day,
      symbol: trade.symbol,
      side: trade.side,
      qty: trade.qty,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      realized_pl: trade.realized_pl,
      opened_at: trade.opened_at,
      closed_at: trade.closed_at,
      source: trade.source,
      mode: trade.mode,
      external_trade_id: trade.external_trade_id,
    }));

    const { error: tradeError } = await supabaseAdmin
      .from("trade_history")
      .upsert(tradeHistoryRows as never, {
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
    snapshot_id: savedSnapshot?.id ?? null,
    snapshot_ts: snapshot.snapshotTs,
    mode: snapshot.mode,
    completed_trades_found: trades.length,
    completed_trades_upserted: upsertedTrades,
    data: savedSnapshot,
  });
}

function getTimeZoneOffsetMs(utcGuessMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcGuessMs));

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );

  return asUtc - utcGuessMs;
}

function localTimeToUtcIso(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string,
) {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess - offsetMs).toISOString();
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed" },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    },
  );
}

export async function POST(req: NextRequest) {
  let auth: AuthorizedRequest | null = null;
  try {
    const result = await authorizeRequest(req);
    if ("error" in result) return result.error;
    auth = result.auth;

    return auth.applyCookies(await handleIngest());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown ingest error";

    const response = NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
    return auth ? auth.applyCookies(response) : response;
  }
}
