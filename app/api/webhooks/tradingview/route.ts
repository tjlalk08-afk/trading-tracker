import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TvPayload = {
  type?: string; // EXEC / STATS (often missing)
  secret?: string;
  strategy?: string;
  symbol?: string;
  timeframe?: string;
  action?: string; // LONG / SHORT / CLOSE
  signal_id?: string;
  bar_time?: string; // ISO-ish string (optional)
  price?: number | string; // optional
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
function toIsoOrNow(v: unknown) {
  const s = normString(v);
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
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
  const type = normUpper(payload.type) ?? "EXEC"; // default to EXEC if missing
  const strategy = normString(payload.strategy) ?? "UNKNOWN";
  const symbol = normString(payload.symbol);
  const action = normUpper(payload.action); // LONG / SHORT / CLOSE
  const timeframe = normString(payload.timeframe);
  const signalId = normString(payload.signal_id);
  const price = normNumber(payload.price);
  const eventTime = toIsoOrNow(payload.bar_time);

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

  // Only build trades for EXEC-ish actions
  if (type !== "EXEC") return NextResponse.json({ ok: true });

  // We can only build trades if we at least know symbol+timeframe+action
  if (!symbol || !timeframe || !action) return NextResponse.json({ ok: true });

  // Trade matching key:
  // - Best: signal_id (if you guarantee entry+close share it)
  // - Fallback: one-open-trade-per strategy+symbol+timeframe
  const tradeKey = signalId ?? `${strategy}:${symbol}:${timeframe}`;

  // ENTRY: create an open trade row if none open
  if (action === "LONG" || action === "SHORT") {
    const { data: open, error: openErr } = await supabase
      .from("tv_trades")
      .select("id")
      .eq("strategy", strategy)
      .eq("symbol", symbol)
      .eq("timeframe", timeframe)
      .is("exit_time", null)
      .order("entry_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openErr) return NextResponse.json({ ok: false, error: openErr.message }, { status: 500 });

    if (!open) {
      const { error } = await supabase.from("tv_trades").insert({
        trade_key: tradeKey,
        strategy,
        symbol,
        timeframe,
        direction: action, // LONG / SHORT
        entry_time: eventTime,
        entry_price: price, // can be null
        entry_signal_id: signalId,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // CLOSE: close the most recent open trade for that strategy/symbol/timeframe
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
      const entry = normNumber(open.entry_price);
      const exit = price;

      const pnl =
        entry !== null && exit !== null
          ? open.direction === "LONG"
            ? exit - entry
            : entry - exit
          : null;

      const win = pnl !== null ? pnl > 0 : null;

      const { error } = await supabase
        .from("tv_trades")
        .update({
          exit_time: eventTime,
          exit_price: exit, // can be null
          pnl,              // null if missing prices
          win,              // null if pnl null
          exit_signal_id: signalId,
        })
        .eq("id", open.id);

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
