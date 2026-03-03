import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import dns from "node:dns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Force IPv4-first in THIS function runtime
dns.setDefaultResultOrder("ipv4first");

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
        {
          ok: false,
          error: "missing supabase env vars",
          hasSupabaseUrl: !!supabaseUrl,
          hasServiceRole: !!serviceKey,
        },
        { status: 500 }
      );
    }

    // DNS diagnostic: extract hostname from SUPABASE_URL and attempt lookup
    const host = new URL(supabaseUrl).hostname;
    let dnsResult: any = null;
    try {
      dnsResult = await new Promise((resolve, reject) => {
        dns.lookup(host, { all: true }, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      });
    } catch (e: any) {
      return NextResponse.json(
        {
          ok: false,
          error: "dns_lookup_failed",
          host,
          message: e?.message ?? String(e),
        },
        { status: 500 }
      );
    }

    // Fetch bot JSON from your working proxy
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

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

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
        { ok: false, error: "supabase_insert_failed", details: insErr, dnsResult, host },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, dnsResult, host });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "route_crashed", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}