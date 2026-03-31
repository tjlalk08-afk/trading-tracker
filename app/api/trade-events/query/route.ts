import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TradeEventRow = {
  id: number;
  event_id: string;
  event_time_utc: string;
  event_type: string;
  symbol: string;
  underlying_symbol: string | null;
  signal_id: string | null;
  trade_id: string | null;
  parent_event_id: string | null;
  mode: string;
  is_test: boolean;
  strategy: string | null;
  engine: string | null;
  side: string | null;
  source: string;
  notes: string | null;
  payload: Record<string, unknown> | null;
  producer: string | null;
  schema_version: string | null;
  received_at: string;
};

function clampLimit(value: string | null) {
  const parsed = Number(value ?? 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(250, Math.floor(parsed)));
}

export async function GET(req: NextRequest) {
  const auth = await requireApprovedApiUser(req);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const limit = clampLimit(searchParams.get("limit"));
    const eventType = searchParams.get("eventType")?.trim();
    const mode = searchParams.get("mode")?.trim().toLowerCase();
    const source = searchParams.get("source")?.trim();
    const symbol = searchParams.get("symbol")?.trim().toUpperCase();
    const signalId = searchParams.get("signalId")?.trim();
    const tradeId = searchParams.get("tradeId")?.trim();

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("trade_events")
      .select(
        "id, event_id, event_time_utc, event_type, symbol, underlying_symbol, signal_id, trade_id, parent_event_id, mode, is_test, strategy, engine, side, source, notes, payload, producer, schema_version, received_at",
      )
      .order("event_time_utc", { ascending: false })
      .limit(limit);

    if (eventType) query = query.eq("event_type", eventType);
    if (mode) query = query.eq("mode", mode);
    if (source) query = query.eq("source", source);
    if (symbol) query = query.eq("symbol", symbol);
    if (signalId) query = query.eq("signal_id", signalId);
    if (tradeId) query = query.eq("trade_id", tradeId);

    const { data, error } = await query;

    if (error) {
      return auth.applyCookies(
        NextResponse.json(
          { ok: false, error: `Failed to load trade events: ${error.message}` },
          { status: 500 },
        ),
      );
    }

    return auth.applyCookies(
      NextResponse.json({
        ok: true,
        data: (data as TradeEventRow[] | null) ?? [],
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown trade-events query error";
    const response = NextResponse.json({ ok: false, error: message }, { status: 500 });
    return auth.applyCookies(response);
  }
}
