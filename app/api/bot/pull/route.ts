import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const asNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const num0 = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const eventKey = (parts: Array<string | number | null | undefined>) =>
  parts.map((p) => (p === null || p === undefined ? "" : String(p))).join("|");

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
      return NextResponse.json(
        { ok: false, error: "BOT_DASHBOARD_URL missing" },
        { status: 500 }
      );
    }

    const r = await fetch(botUrl, { cache: "no-store" });

    let json: any = null;
    try {
      json = await r.json();
    } catch {
      const text = await r.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: "bot returned non-json", body: text },
        { status: 502 }
      );
    }

    if (!r.ok || !json?.ok) {
      return NextResponse.json(
        { ok: false, error: `bot fetch failed: ${r.status}`, body: json },
        { status: 502 }
      );
    }

    const data = json?.data ?? {};

    const cash = asNum(data.cash);
    const equity = asNum(data.equity);
    const openPnl = asNum(data.open_pnl);
    const realizedPnl = asNum(data.realized_pnl);

    const positionsObj =
      data.positions && typeof data.positions === "object"
        ? data.positions
        : {};
    const positionsCount = Object.keys(positionsObj).length;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const tsIso = (json.ts ?? new Date().toISOString()) as string;

    // 1️⃣ Insert snapshot
    const { error: snapErr } = await supabase.from("bot_snapshots").insert({
      ts: tsIso,
      equity,
      cash,
      open_pnl: openPnl,
      realized_pnl: realizedPnl,
      positions_count: positionsCount,
      raw: json,
    });

    if (snapErr) {
      return NextResponse.json({ ok: false, error: snapErr.message }, { status: 500 });
    }

    // 2️⃣ Load previous snapshot
    const { data: prevRows, error: prevErr } = await supabase
      .from("bot_snapshots")
      .select("raw, ts")
      .order("ts", { ascending: false })
      .limit(2);

    if (prevErr) {
      return NextResponse.json({ ok: false, error: prevErr.message }, { status: 500 });
    }

    const prevRaw = prevRows?.[1]?.raw ?? null;
    const prevData = prevRaw?.data ?? {};
    const prevPositions =
      prevData.positions && typeof prevData.positions === "object"
        ? prevData.positions
        : {};

    const currPositions =
      data.positions && typeof data.positions === "object"
        ? data.positions
        : {};

    const keys = new Set([
      ...Object.keys(prevPositions),
      ...Object.keys(currPositions),
    ]);

    for (const k of keys) {
      const prev = (prevPositions as any)[k] ?? null;
      const curr = (currPositions as any)[k] ?? null;

      const prevQty = prev ? num0(prev.qty) : 0;
      const currQty = curr ? num0(curr.qty) : 0;

      const symbol = (curr?.option_symbol ?? prev?.option_symbol ?? k) as string;
      const side = curr?.side ?? prev?.side ?? null;
      const entryPrice = curr?.entry_price ?? prev?.entry_price ?? null;
      const markPrice = curr?.mark ?? prev?.mark ?? null;

      const position_id = symbol;

      // OPEN
      if (prevQty === 0 && currQty > 0) {
        const { data: exists } = await supabase
          .from("bot_fills")
          .select("id")
          .eq("position_id", position_id)
          .eq("event_type", "OPEN")
          .eq("ts", tsIso)
          .limit(1);

        if (!exists || exists.length === 0) {
          await supabase.from("bot_fills").insert({
            ts: tsIso,
            position_id,
            symbol,
            side,
            event_type: "OPEN",
            qty: currQty,
            price: entryPrice ?? markPrice,
            realized_pnl: null,
            meta: { source: "pull", dedupe_key: eventKey(["OPEN", position_id, currQty, tsIso]) },
          });
        }
      }

      // CLOSE
      if (prevQty > 0 && currQty === 0) {
        const { data: exists } = await supabase
          .from("bot_fills")
          .select("id")
          .eq("position_id", position_id)
          .eq("event_type", "CLOSE")
          .eq("ts", tsIso)
          .limit(1);

        if (!exists || exists.length === 0) {
          await supabase.from("bot_fills").insert({
            ts: tsIso,
            position_id,
            symbol,
            side,
            event_type: "CLOSE",
            qty: prevQty,
            price: markPrice ?? entryPrice,
            realized_pnl: null,
            meta: { source: "pull", dedupe_key: eventKey(["CLOSE", position_id, prevQty, tsIso]) },
          });
        }
      }

      // ADD / TRIM
      if (prevQty > 0 && currQty > 0 && currQty !== prevQty) {
        const event_type = currQty > prevQty ? "ADD" : "TRIM";
        const deltaQty = Math.abs(currQty - prevQty);

        const { data: exists } = await supabase
          .from("bot_fills")
          .select("id")
          .eq("position_id", position_id)
          .eq("event_type", event_type)
          .eq("ts", tsIso)
          .limit(1);

        if (!exists || exists.length === 0) {
          await supabase.from("bot_fills").insert({
            ts: tsIso,
            position_id,
            symbol,
            side,
            event_type,
            qty: deltaQty,
            price: markPrice ?? entryPrice,
            realized_pnl: null,
            meta: {
              source: "pull",
              prevQty,
              currQty,
              dedupe_key: eventKey([event_type, position_id, deltaQty, tsIso]),
            },
          });
        }
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