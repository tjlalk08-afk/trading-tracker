import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManualTradeInput = {
  symbol?: unknown;
  side?: unknown;
  qty?: unknown;
  entry_price?: unknown;
  exit_price?: unknown;
  realized_pl?: unknown;
  opened_at?: unknown;
  closed_at?: unknown;
  trade_day?: unknown;
  mode?: unknown;
  strategy_name?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberField(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoDateTime(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dateOnly(value: unknown, fallback: string) {
  const raw = text(value);
  if (!raw) return fallback;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const auth = await requireApprovedApiUser(req);
  if ("error" in auth) return auth.error;

  try {
    const body = (await req.json().catch(() => null)) as ManualTradeInput | null;
    const symbol = text(body?.symbol).toUpperCase();
    const side = text(body?.side).toUpperCase();
    const qty = numberField(body?.qty);
    const entryPrice = numberField(body?.entry_price);
    const exitPrice = numberField(body?.exit_price);
    const realizedPl = numberField(body?.realized_pl);
    const closedAt = isoDateTime(body?.closed_at) ?? new Date().toISOString();
    const openedAt = isoDateTime(body?.opened_at);
    const tradeDay = dateOnly(body?.trade_day, closedAt.slice(0, 10));
    const mode = text(body?.mode).toLowerCase() === "paper" ? "paper" : "live";
    const strategyName = text(body?.strategy_name) || null;

    if (!symbol) {
      return auth.applyCookies(NextResponse.json({ ok: false, error: "Symbol is required." }, { status: 400 }));
    }
    if (!side) {
      return auth.applyCookies(NextResponse.json({ ok: false, error: "Side/type is required." }, { status: 400 }));
    }
    if (qty == null || qty <= 0) {
      return auth.applyCookies(NextResponse.json({ ok: false, error: "Quantity must be greater than zero." }, { status: 400 }));
    }
    if (entryPrice == null || exitPrice == null || realizedPl == null) {
      return auth.applyCookies(NextResponse.json({ ok: false, error: "Entry, exit, and realized P/L are required." }, { status: 400 }));
    }

    const manualTrade = {
      snapshot_date: tradeDay,
      trade_day: tradeDay,
      symbol,
      side,
      qty,
      entry_price: entryPrice,
      exit_price: exitPrice,
      realized_pl: realizedPl,
      opened_at: openedAt,
      closed_at: closedAt,
      source: "manual",
      external_trade_id: `manual:${crypto.randomUUID()}`,
      strategy_name: strategyName,
      account_type: mode,
      mode,
    };

    const { data, error } = await getSupabaseAdmin()
      .from("trade_history")
      .insert(manualTrade as never)
      .select("*")
      .single();

    if (error) {
      return auth.applyCookies(
        NextResponse.json({ ok: false, error: `Failed to save manual trade: ${error.message}` }, { status: 500 }),
      );
    }

    return auth.applyCookies(NextResponse.json({ ok: true, data }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save manual trade.";
    return auth.applyCookies(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
