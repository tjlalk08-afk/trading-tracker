import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (token !== process.env.TRADINGVIEW_WEBHOOK_TOKEN) {
    return NextResponse.json({ ok: false, error: "bad token" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("tv_signals").insert({
    symbol: payload.symbol ?? null,
    action: payload.action ?? null,
    timeframe: payload.timeframe ?? null,
    raw_payload: payload,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
