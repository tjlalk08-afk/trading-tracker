import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ")
      ? auth.slice(7).trim()
      : "";

    const expected = (process.env.BOT_API_TOKEN ?? "").trim();

    if (!expected || token !== expected) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      position_id,
      symbol,
      side,
      event_type,   // OPEN | ADD | TRIM | CLOSE
      qty,
      price,
      realized_pnl,
      meta
    } = body ?? {};

    if (!position_id || !symbol || !event_type) {
      return NextResponse.json(
        { ok: false, error: "missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const nowIso = new Date().toISOString();

    // 1️⃣ Always insert into bot_fills
    const { error } = await supabase.from("bot_fills").insert({
      ts: nowIso,
      position_id,
      symbol,
      side,
      event_type,
      qty,
      price,
      realized_pnl,
      meta: meta ?? null
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    // 2️⃣ If this is a CLOSE event, also insert into bot_trades_closed
    if (event_type === "CLOSE") {
      const { error: closeErr } = await supabase
        .from("bot_trades_closed")
        .insert({
          closed_at: nowIso,
          symbol,
          side,
          qty,
          entry_price: null,           // can enhance later
          exit_price: price ?? null,
          pnl: realized_pnl ?? null,
          fees: 0,
          strategy: null,
          created_at: nowIso
        });

      if (closeErr) {
        return NextResponse.json(
          { ok: false, error: closeErr.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}