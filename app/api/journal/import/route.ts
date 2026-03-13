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

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSymbol(value: string | null) {
  if (!value) return "UNKNOWN";
  return value.replace(/_TEST$/i, "");
}

function accountFromSource(source: string | null) {
  return source?.toLowerCase().includes("test") ? "test" : "live";
}

function displaySymbolFromRow(row: TradeHistoryRow) {
  return normalizeSymbol(row.symbol);
}

function chartSymbolFromRow(row: TradeHistoryRow) {
  return normalizeSymbol(row.symbol);
}

function durationMinutes(row: TradeHistoryRow) {
  if (!row.opened_at || !row.closed_at) return null;
  const opened = new Date(row.opened_at).getTime();
  const closed = new Date(row.closed_at).getTime();
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
      .map((row) => ({
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
        opened_at: row.opened_at,
        closed_at: row.closed_at,
        entry_price: toNumber(row.entry_price),
        exit_price: toNumber(row.exit_price),
        quantity: toNumber(row.qty),
        gross_pl: toNumber(row.realized_pl),
        fees: 0,
        return_pct: returnPct(row),
        duration_minutes: durationMinutes(row),
        status: "closed",
        imported_from_trade_history: true,
      }));

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
