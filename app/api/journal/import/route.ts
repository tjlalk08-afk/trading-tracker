import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TradeHistoryRow = {
  id: number;
  snapshot_date: string | null;
  trade_day: string | null;
  symbol: string | null;
  option_symbol?: string | null;
  side: string | null;
  qty: number | string | null;
  entry_price: number | string | null;
  exit_price: number | string | null;
  realized_pl: number | string | null;
  opened_at: string | null;
  closed_at: string | null;
  source: string | null;
  external_trade_id: string | null;
};

const BOT_SOURCE_TIMEZONE =
  process.env.BROTHER_BOT_SOURCE_TIMEZONE?.trim() || "America/New_York";
const DISPLAY_TIMEZONE = "America/Chicago";

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSymbol(value: string | null) {
  if (!value) return "UNKNOWN";
  return value.replace(/_TEST$/i, "");
}

function normalizeOptionChartSymbol(value: string | null) {
  if (!value) return null;
  const compact = value.replace(/\s+/g, "").trim();
  return compact || null;
}

function accountFromSource(source: string | null) {
  return source?.toLowerCase().includes("test") ? "test" : "live";
}

function displaySymbolFromRow(row: TradeHistoryRow) {
  return normalizeSymbol(row.symbol);
}

function chartSymbolFromRow(row: TradeHistoryRow) {
  return normalizeOptionChartSymbol(row.option_symbol) ?? normalizeSymbol(row.symbol);
}

function chicagoHourFromIso(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value;
  return hour ? Number(hour) : null;
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

function reinterpretUtcClockAsTimezone(value: string | null, timeZone: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const utcGuess = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  );

  const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess - offsetMs).toISOString();
}

function fixLegacyBrotherTimestamp(value: string | null, source: string | null) {
  if (!value || !source?.startsWith("brother_")) return value;
  const localHour = chicagoHourFromIso(value);

  // Legacy brother trades were stored with local bot clock values interpreted as UTC.
  // If a closed trade lands deep premarket in Chicago, reinterpret that wall clock
  // in the configured bot timezone so journal replay uses the intended trade time.
  if (localHour !== null && localHour < 7) {
    return reinterpretUtcClockAsTimezone(value, BOT_SOURCE_TIMEZONE);
  }

  return value;
}

function durationMinutes(row: TradeHistoryRow) {
  const openedAt = fixLegacyBrotherTimestamp(row.opened_at, row.source);
  const closedAt = fixLegacyBrotherTimestamp(row.closed_at, row.source);
  if (!openedAt || !closedAt) return null;
  const opened = new Date(openedAt).getTime();
  const closed = new Date(closedAt).getTime();
  if (!Number.isFinite(opened) || !Number.isFinite(closed) || closed < opened) {
    return null;
  }
  return Math.round((closed - opened) / 60000);
}

function returnPct(row: TradeHistoryRow) {
  const qty = Math.abs(toNumber(row.qty));
  const entry = toNumber(row.entry_price);
  const realized = toNumber(row.realized_pl);
  const costBasis = qty * entry;

  if (!costBasis) return 0;
  return (realized / costBasis) * 100;
}

export async function POST() {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("trade_history")
      .select(
        [
          "id",
          "snapshot_date",
          "trade_day",
          "symbol",
          "option_symbol",
          "side",
          "qty",
          "entry_price",
          "exit_price",
          "realized_pl",
          "opened_at",
          "closed_at",
          "source",
          "external_trade_id",
        ].join(","),
      )
      .order("closed_at", { ascending: false })
      .limit(5000);

    if (error) {
      return NextResponse.json(
        { ok: false, error: `Failed to load trade history for import: ${error.message}` },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as TradeHistoryRow[];
    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        skipped: 0,
        message: "No trade_history rows were found to import.",
      });
    }

    const importRows = rows
      .filter((row) => row.closed_at && row.symbol)
      .map((row) => {
        const openedAt = fixLegacyBrotherTimestamp(row.opened_at, row.source);
        const closedAt = fixLegacyBrotherTimestamp(row.closed_at, row.source);

        return {
        source: "trade_history_import",
        source_trade_id:
          row.external_trade_id?.trim() ||
          `trade_history:${row.id}`,
        account: accountFromSource(row.source),
        trade_group_key: row.external_trade_id?.trim() || `trade_history:${row.id}`,
        symbol: normalizeSymbol(row.symbol),
        display_symbol: displaySymbolFromRow(row),
        option_symbol: row.option_symbol ?? null,
        chart_symbol: chartSymbolFromRow(row),
        chart_timeframe: "5m",
        asset_type: "option",
        strategy: row.source,
        side: row.side,
        opened_at: openedAt,
        closed_at: closedAt,
        entry_price: toNumber(row.entry_price),
        exit_price: toNumber(row.exit_price),
        quantity: toNumber(row.qty),
        gross_pl: toNumber(row.realized_pl),
        fees: 0,
        return_pct: returnPct(row),
        duration_minutes: durationMinutes(row),
        status: "closed",
        imported_from_trade_history: true,
      };
      });

    const { error: upsertError } = await admin
      .from("trade_journal_trades")
      .upsert(importRows as never, {
        onConflict: "source_trade_id",
      });

    if (upsertError) {
      return NextResponse.json(
        { ok: false, error: `Failed to import trade journal rows: ${upsertError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      imported: importRows.length,
      skipped: rows.length - importRows.length,
      message: "Trade history imported into the journal.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected journal import error",
      },
      { status: 500 },
    );
  }
}
