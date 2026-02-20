import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const asNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("token") ?? "").trim();
    const expected = (process.env.BOT_API_TOKEN ?? "").trim();

    if (!expected || token !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const botUrl = process.env.BOT_DASHBOARD_URL;
    if (!botUrl) {
      return NextResponse.json({ ok: false, error: "BOT_DASHBOARD_URL missing" }, { status: 500 });
    }

    const r = await fetch(botUrl, { cache: "no-store" });

    let json: any = null;
    try {
      json = await r.json();
    } catch {
      const text = await r.text().catch(() => "");
      return NextResponse.json({ ok: false, error: "bot returned non-json", body: text }, { status: 502 });
    }

    if (!r.ok || !json?.ok) {
      return NextResponse.json({ ok: false, error: `bot fetch failed: ${r.status}`, body: json }, { status: 502 });
    }

    const data = json?.data ?? {};

    const cash = asNum(data.cash);
    const equity = asNum(data.equity);
    const openPnl = asNum(data.open_pnl);
    const realizedPnl = asNum(data.realized_pnl);

    // positions is an object in your JSON ({}), so count keys
    const positionsObj = data.positions && typeof data.positions === "object" ? data.positions : {};
    const positionsCount = Object.keys(positionsObj).length;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.from("bot_snapshots").insert({
      ts: json.ts ?? new Date().toISOString(),
      equity,
      cash,
      open_pnl: openPnl,
      realized_pnl: realizedPnl,
      positions_count: positionsCount,
      raw: json,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      inserted: { equity, cash, open_pnl: openPnl, realized_pnl: realizedPnl, positions_count: positionsCount },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "unknown error" }, { status: 500 });
  }
}
