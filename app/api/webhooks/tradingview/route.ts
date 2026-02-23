import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TvPayload = {
  type?: string;
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
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function toIsoOrNow(v: unknown) {
  const s = normString(v);
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? new Date().toISOString()
    : d.toISOString();
}

export async function POST(req: Request) {
  // ===== TOKEN CHECK =====
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  const expected = (process.env.TRADINGVIEW_WEBHOOK_TOKEN ?? "").trim();

  if (!expected || token !== expected) {
    return NextResponse.json(
      { ok: false, error: "bad token" },
      { status: 401 }
    );
  }

  // ===== PARSE BODY =====
  const payload = (await req.json().catch(() => null)) as TvPayload | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 }
    );
  }

  // Optional Pine secret check
  const expectedSecret = process.env.TRADINGVIEW_PINE_SECRET;
  if (expectedSecret && payload.secret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "bad secret" },
      { status: 401 }
    );
  }

  // ===== NORMALIZE =====
  const type = normUpper(payload.type) ?? "EXEC";
  const strategy = normString(payload.strategy) ?? "UNKNOWN";
  const symbol = normString(payload.symbol);
  const action = normUpper(payload.action);
  const timeframe = normString(payload.timeframe);
  const signalId = normString(payload.signal_id);
  const price = normNumber(payload.price);
  const eventTime = toIsoOrNow(payload.bar_time);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ===== ALWAYS STORE RAW SIGNAL =====
  const { error: signalError } = await supabase.from("tv_signals").insert({
    symbol,
    action,
    timeframe,
    raw_payload: payload,
  });

  if (signalError) {
    return NextResponse.json(
      { ok: false, error: signalError.message },
      { status: 500 }
    );
  }

  // Only build trades from EXEC signals
  if (type !== "EXEC" || !symbol || !timeframe || !action) {
    return NextResponse.json({ ok: true });
  }

  // ===== ENTRY =====
  if (action === "LONG" || action === "SHORT") {
    const { data: open } = await supabase
      .from("tv_trades")
      .select("id")
      .eq("strategy", strategy)
      .eq("symbol", symbol)
      .eq("timeframe", timeframe)
      .is("exit_time", null)
      .order("entry_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!open) {
      const { error } = await supabase.from("tv_trades").insert({
        strategy,
        symbol,
        timeframe,
        direction: action,
        entry_time: eventTime,
        entry_price: price,
        entry_signal_id: signalId,
      });

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  }

  // ===== CLOSE =====
  if (action === "CLOSE") {
    const { data: open } = await supabase
      .from("tv_trades")
      .select("*")
      .eq("strategy", strategy)
      .eq("symbol", symbol)
      .eq("timeframe", timeframe)
      .is("exit_time", null)
      .order("entry_time", { ascending: false })
      .limit(1)
      .maybeSingle();

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
          exit_price: exit,
          pnl,
          win,
          exit_signal_id: signalId,
        })
        .eq("id", open.id);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
