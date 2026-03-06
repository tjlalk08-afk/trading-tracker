import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BROTHER_DASHBOARD_URL = "https://dashboard.ngtdashboard.com/api/dashboard";

type BrotherDashboardPayload = {
  ok?: boolean;
  data?: {
    updated?: string;
    cash?: number;
    realized_pl?: number;
    open_pnl?: number;
    total_pnl?: number;
    equity?: number;

    live_cash?: number;
    live_realized_pnl?: number;
    live_open_pnl?: number;
    live_total_pnl?: number;
    live_equity?: number;

    test_cash?: number;
    test_realized_pnl?: number;
    test_open_pnl?: number;
    test_total_pnl?: number;
    test_equity?: number;

    realized_pct?: number;
    open_pnl_pct?: number;
    total_pnl_pct?: number;

    live_realized_pct?: number;
    live_open_pnl_pct?: number;
    live_total_pnl_pct?: number;

    live_realized_percent?: number;
    live_open_percent?: number;
    live_total_percent?: number;

    test_realized_pct?: number;
    test_open_pnl_pct?: number;
    test_total_pnl_pct?: number;

    positions?: Record<string, any>;
    ts?: string;
  };
};

function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function ingestBrotherDashboard() {
  const res = await fetch(BROTHER_DASHBOARD_URL, {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: `Brother dashboard fetch failed: ${res.status}` },
      { status: 502 }
    );
  }

  const json = (await res.json()) as BrotherDashboardPayload;
  const data = json?.data;

  if (!json?.ok || !data) {
    return NextResponse.json(
      { ok: false, error: "Brother dashboard returned invalid payload" },
      { status: 502 }
    );
  }

  const snapshotTs = data.ts || new Date().toISOString();

  const snapshotRow = {
    source: "brother_dashboard",
    snapshot_ts: snapshotTs,
    updated_text: data.updated ?? null,

    cash: num(data.cash),
    realized_pl: num(data.realized_pl),
    open_pl: num(data.open_pnl),
    total_pl: num(data.total_pnl),
    equity: num(data.equity),

    live_cash: num(data.live_cash),
    live_realized_pl: num(data.live_realized_pnl),
    live_open_pl: num(data.live_open_pnl),
    live_total_pl: num(data.live_total_pnl),
    live_equity: num(data.live_equity),

    test_cash: num(data.test_cash),
    test_realized_pl: num(data.test_realized_pnl),
    test_open_pl: num(data.test_open_pnl),
    test_total_pl: num(data.test_total_pnl),
    test_equity: num(data.test_equity),

    realized_pct: num(data.realized_pct),
    open_pct: num(data.open_pnl_pct),
    total_pct: num(data.total_pnl_pct),

    live_realized_pct: num(data.live_realized_pct ?? data.live_realized_percent),
    live_open_pct: num(data.live_open_pnl_pct ?? data.live_open_percent),
    live_total_pct: num(data.live_total_pnl_pct ?? data.live_total_percent),

    test_realized_pct: num(data.test_realized_pct),
    test_open_pct: num(data.test_open_pnl_pct),
    test_total_pct: num(data.test_total_pnl_pct),

    raw_payload: data,
  };

  const { error: snapshotError } = await supabaseAdmin
    .from("dashboard_snapshots")
    .upsert(snapshotRow, { onConflict: "source,snapshot_ts" });

  if (snapshotError) {
    return NextResponse.json(
      { ok: false, error: snapshotError.message },
      { status: 500 }
    );
  }

  const positions = data.positions ?? {};
  const positionRows = Object.entries(positions).map(([symbol, payload]) => {
    const p = payload as Record<string, any>;

    return {
      snapshot_ts: snapshotTs,
      source: "brother_dashboard",
      symbol,
      side: p.side ?? null,
      qty: num(p.qty),
      entry_price: p.entry_price == null ? null : num(p.entry_price),
      mark_price: p.mark_price == null ? null : num(p.mark_price),
      open_pl: num(p.open_pl),
      open_pl_pct: p.open_pl_pct == null ? null : num(p.open_pl_pct),
      option_symbol: p.option_symbol ?? null,
      mode: p.mode ?? null,
      raw_payload: p,
    };
  });

  if (positionRows.length > 0) {
    const { error: positionsError } = await supabaseAdmin
      .from("position_snapshots")
      .insert(positionRows);

    if (positionsError) {
      return NextResponse.json(
        { ok: false, error: positionsError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    snapshot_ts: snapshotTs,
    saved_positions: positionRows.length,
  });
}

export async function GET() {
  try {
    return await ingestBrotherDashboard();
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown ingest error" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    return await ingestBrotherDashboard();
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown ingest error" },
      { status: 500 }
    );
  }
}