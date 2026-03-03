import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pos = {
  symbol: string;
  side: string;
  qty: number | null;
  entry: number | null;
  mark: number | null;
  open_pnl: number | null;
  open_pnl_pct: number | null;
  option_symbol: string | null;
};

function n(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function s(v: any): string {
  return (v ?? "").toString();
}

function positionKey(p: Pos) {
  // stable key so we can detect disappearance
  // include option_symbol if present; fallback to symbol+side
  const opt = (p.option_symbol ?? "").trim();
  return `${p.symbol}|${p.side}|${opt}`;
}

function parsePositions(raw: any): { live: Pos[]; test: Pos[] } {
  // Your bot often returns `positions: {}` when empty.
  // When non-empty, it may be:
  // - positions: { live: [...], test: [...] }
  // - positions: { LIVE: [...], TEST: [...] }
  // - or direct arrays elsewhere (rare)
  if (!raw) return { live: [], test: [] };
  if (typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw).length === 0) {
    return { live: [], test: [] };
  }

  const norm = (r: any): Pos => ({
    symbol: s(r.symbol ?? r.ticker ?? r.underlying ?? r.sym).toUpperCase(),
    side: s(r.side ?? r.dir ?? r.direction).toUpperCase(),
    qty: n(r.qty ?? r.quantity ?? r.contracts),
    entry: n(r.entry ?? r.entry_price ?? r.avg_entry ?? r.avgEntry),
    mark: n(r.mark ?? r.mark_price ?? r.mid ?? r.price),
    open_pnl: n(r.open_pnl ?? r.openPnl ?? r.pnl ?? r.unrealized ?? r.unrealized_pnl),
    open_pnl_pct: n(r.open_pnl_pct ?? r.openPnlPct ?? r.pnl_pct ?? r.unrealized_pct),
    option_symbol: (r.option_symbol ?? r.optionSymbol ?? r.contract ?? r.contract_symbol ?? null)
      ? s(r.option_symbol ?? r.optionSymbol ?? r.contract ?? r.contract_symbol)
      : null,
  });

  // If it’s already arrays
  if (Array.isArray(raw)) return { live: raw.map(norm), test: [] };

  // Try common keys
  const liveArr = raw.live ?? raw.LIVE ?? raw.real ?? raw.REAL;
  const testArr = raw.test ?? raw.TEST ?? raw.shadow ?? raw.SHADOW ?? raw.test_shadow;

  if (Array.isArray(liveArr) || Array.isArray(testArr)) {
    return {
      live: Array.isArray(liveArr) ? liveArr.map(norm) : [],
      test: Array.isArray(testArr) ? testArr.map(norm) : [],
    };
  }

  // Fallback: scan object values
  const live: any[] = [];
  const test: any[] = [];
  for (const [k, v] of Object.entries(raw)) {
    const lk = k.toLowerCase();
    if (Array.isArray(v)) {
      if (lk.includes("test") || lk.includes("shadow")) test.push(...v);
      else live.push(...v);
    }
  }
  return { live: live.map(norm), test: test.map(norm) };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "missing supabase env vars" },
      { status: 500 }
    );
  }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1) Fetch bot JSON
  const upstream = await fetch("https://dashboard.ngtdashboard.com/api/dashboard", {
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, error: "bot upstream failed", status: upstream.status },
      { status: 502 }
    );
  }

  const payload = await upstream.json();
  const d = payload?.data ?? {};
  const bot_id = "ngt-bot";

  // 2) Insert equity point
  await sb.from("bot_equity_points").insert({
    bot_id,
    updated_text: d.updated ?? null,

    cash: n(d.cash),
    equity: n(d.equity),

    live_realized_pnl: n(d.live_realized_pnl),
    live_open_pnl: n(d.live_open_pnl),
    live_total_pnl: n(d.live_total_pnl),

    test_cash: n(d.test_cash),
    test_equity: n(d.test_equity),
    test_realized_pnl: n(d.test_realized_pnl),
    test_open_pnl: n(d.test_open_pnl),
    test_total_pnl: n(d.test_total_pnl),
  });

  // 3) Normalize positions
  const { live, test } = parsePositions(d.positions);

  // 4) Upsert open positions + detect closes (LIVE then TEST)
  async function reconcile(is_test: boolean, current: Pos[]) {
    const nowIso = new Date().toISOString();

    // Fetch current open positions in DB
    const { data: prevRows, error: prevErr } = await sb
      .from("bot_open_positions")
      .select("*")
      .eq("bot_id", bot_id)
      .eq("is_test", is_test);

    if (prevErr) throw prevErr;

    const prev = prevRows ?? [];
    const prevMap = new Map<string, any>();
    for (const r of prev) prevMap.set(r.position_key, r);

    const currKeys = new Set<string>();
    const upserts: any[] = [];

    for (const p of current) {
      if (!p.symbol || !p.side) continue;
      const key = positionKey(p);
      currKeys.add(key);

      const existing = prevMap.get(key);
      upserts.push({
        bot_id,
        is_test,
        position_key: key,
        symbol: p.symbol,
        side: p.side,
        qty: p.qty,
        entry: p.entry,
        mark: p.mark,
        open_pnl: p.open_pnl,
        open_pnl_pct: p.open_pnl_pct,
        option_symbol: p.option_symbol,
        first_seen_at: existing?.first_seen_at ?? nowIso,
        last_seen_at: nowIso,
      });
    }

    // Upsert current open positions
    if (upserts.length) {
      const { error: upErr } = await sb
        .from("bot_open_positions")
        .upsert(upserts, { onConflict: "bot_id,is_test,position_key" });

      if (upErr) throw upErr;
    }

    // Detect closes: prev keys not in currKeys
    const closed: any[] = [];
    for (const r of prev) {
      if (!currKeys.has(r.position_key)) {
        closed.push({
          bot_id,
          is_test,
          position_key: r.position_key,
          symbol: r.symbol,
          side: r.side,
          qty: r.qty,
          entry: r.entry,
          last_mark: r.mark,
          last_open_pnl: r.open_pnl,
          last_open_pnl_pct: r.open_pnl_pct,
          option_symbol: r.option_symbol,
          first_seen_at: r.first_seen_at,
          last_seen_at: r.last_seen_at,
          closed_at: nowIso,
          close_reason: "disappeared",
        });
      }
    }

    // Insert closed trades and delete from open_positions
    if (closed.length) {
      const { error: cErr } = await sb.from("bot_closed_trades").insert(closed);
      if (cErr) throw cErr;

      const keysToDelete = closed.map((x) => x.position_key);
      const { error: dErr } = await sb
        .from("bot_open_positions")
        .delete()
        .eq("bot_id", bot_id)
        .eq("is_test", is_test)
        .in("position_key", keysToDelete);

      if (dErr) throw dErr;
    }
  }

  await reconcile(false, live);
  await reconcile(true, test);

  return NextResponse.json({ ok: true, live_open: live.length, test_open: test.length });
}