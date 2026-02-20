import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TvPayload = {
  type?: string; // EXEC / STATS
  secret?: string;
  strategy?: string;
  symbol?: string;
  timeframe?: string;
  action?: string; // LONG / SHORT / CLOSE
  signal_id?: string;
  bar_time?: string;
  price?: number | string;
  [k: string]: any;
};

function normString(v: unknown) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

function normUpper(v: unknown) {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  return s.length ? s : null;
}

function normNumber(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

export async function POST(req: Request) {
  // 1) URL token check
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

  // 3) Pine secret check
  const expectedSecret = process.env.TRADINGVIEW_PINE_SECRET;
  if (expectedSecret && payload.secret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "bad secret" }, { status: 401 });
  }

  // 4) Normalize fields
  const type = normString(payload.type) ?? "UNKNOWN";
  const strategy = normString(payload.strategy) ?? "UNKNOWN";
  const symbol = normString(payload.symbol);
  const action = normUpper(payload.action);
  const timeframe = normString(payload.timeframe);
  const signalId = normString(payload.signal_id);
  const price = normNumber(payload.price);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 5) Always store raw signal
  {
    const { error } = await supabase.from("tv_signals").insert({
      symbol,
      action,
      timeframe,
      raw_payload: payload,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // 6) Build paper trades (tv_trades) from EXEC signals only
  if (type === "EXEC" && symbol && timeframe && action && signalId && price !== null) {
    // Open trade on LONG/SHORT (only if none open)
    if (action === "LONG" || action === "SHORT") {
      const { data: open, error: openErr } = await supabase
        .from("tv_trades")
        .select("id")
        .eq("strategy", strategy)
        .eq("symbol", symbol)
        .eq("timeframe", timeframe)
        .is("exit_time", null)
        .maybeSingle();

      if (openErr) return NextResponse.json({ ok: false, error: openErr.message }, { status: 500 });

      if (!open) {
        const { error } = await supabase.from("tv_trades").insert({
          strategy,
          symbol,
          timeframe,
          direction: action, // LONG / SHORT
          entry_time: new Date().toISOString(),
          entry_price: price,
          entry_signal_id: signalId,
        });
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    // Close trade on CLOSE
    if (action === "CLOSE") {
      const { data: open, error: openErr } = await supabase
        .from("tv_trades")
        .select("*")
        .eq("strategy", strategy)
        .eq("symbol", symbol)
        .eq("timeframe", timeframe)
        .is("exit_time", null)
        .order("entry_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openErr) return NextResponse.json({ ok: false, error: openErr.message }, { status: 500 });

      if (open) {
        const entry = Number(open.entry_price);
        const exit = price;
        const pnl = open.direction === "LONG" ? exit - entry : entry - exit;
        const win = pnl > 0;

        const { error } = await supabase
          .from("tv_trades")
          .update({
            exit_time: new Date().toISOString(),
            exit_price: exit,
            pnl,
            win,
            exit_signal_id: signalId,
          })
          .eq("id", open.id);

        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
