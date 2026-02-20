import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("token") ?? "").trim();
    const expected = (process.env.BOT_API_TOKEN ?? "").trim();

    if (!expected || token !== expected) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const botUrl = process.env.BOT_DASHBOARD_URL;
    if (!botUrl) {
      return NextResponse.json(
        { ok: false, error: "BOT_DASHBOARD_URL missing" },
        { status: 500 }
      );
    }

    const r = await fetch(botUrl, { cache: "no-store" });
    const json = await r.json();

    if (!r.ok || !json?.ok) {
      return NextResponse.json(
        { ok: false, error: "bot fetch failed", body: json },
        { status: 502 }
      );
    }

    const data = json.data ?? {};

    const cash = Number(data.cash ?? 0);
    const equity = Number(data.equity ?? 0);
    const openPnl = Number(data.open_pnl ?? 0);
    const realizedPnl = Number(data.realized_pnl ?? 0);
    const positionsCount = data.positions
      ? Object.keys(data.positions).length
      : 0;

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
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
