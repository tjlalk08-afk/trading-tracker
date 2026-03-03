import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function n(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function GET(req: Request) {
  try {
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

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // ✅ Fetch from YOUR OWN proxy route (more reliable in Vercel)
    const upstream = await fetch("https://ngtdashboard.com/api/bot/dashboard", {
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: "bot proxy failed", status: upstream.status },
        { status: 502 }
      );
    }

    const payload = await upstream.json();
    const d = payload?.data ?? {};
    const bot_id = "ngt-bot";

    const { error: insErr } = await sb.from("bot_equity_points").insert({
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

    if (insErr) {
      return NextResponse.json(
        { ok: false, error: "supabase insert failed", details: insErr },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "route crashed", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}