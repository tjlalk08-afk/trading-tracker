import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TvPayload = {
  type?: "EXEC" | "STATS" | string;
  secret?: string;
  strategy?: string;
  symbol?: string;
  action?: string; // LONG | SHORT | CLOSE | TEST | etc.
  timeframe?: string;
  signal_id?: string;
  bar_time?: string; // epoch ms string in your script
  price?: number | string;

  // STATS fields (optional)
  profit_factor?: number;
  net_profit?: number;
  closed_trades?: number;
  win_trades?: number;
  gross_profit?: number;
  gross_loss?: number;
  max_drawdown?: number;

  [k: string]: any;
};

function normString(v: unknown) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

function normAction(v: unknown) {
  const a = typeof v === "string" ? v.trim().toUpperCase() : "";
  return a.length ? a : null;
}

export async function POST(req: Request) {
  // 1) URL token check (your existing protection)
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (token !== process.env.TRADINGVIEW_WEBHOOK_TOKEN) {
    return NextResponse.json({ ok: false, error: "bad token" }, { status: 401 });
  }

  // 2) Parse JSON body
  const payload = (await req.json().catch(() => null)) as TvPayload | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // 3) Pine secret check (matches your Pine `webhookSecret`)
  const expectedSecret = process.env.TRADINGVIEW_PINE_SECRET;
  if (expectedSecret && payload.secret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "bad secret" }, { status: 401 });
  }

  // 4) Normalize what we store in columns your dashboard uses
  const type = normString(payload.type) ?? "UNKNOWN";
  const symbol = normString(payload.symbol);
  const action = normAction(payload.action) ?? (type === "STATS" ? "STATS" : null);
  const timeframe = normString(payload.timeframe);

  // 5) Insert (always store full raw_payload so you never “lose” fields)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("tv_signals").insert({
    symbol,
    action,
    timeframe,
    raw_payload: payload,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
