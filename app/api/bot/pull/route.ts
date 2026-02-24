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

// A simple stable hash/string for deduping events (so repeated pulls don't spam fills)
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
      return NextResponse.json({ ok: false, error: "BOT_DASHBOARD_URL missing" }, { status: 500 });
    }

    const r = await fetch(botUrl, { cache: "no-store" });

    let json: any = null;
    try {
      json = await r.json();
    } catch {
      const text = await r.text().catch(() => "");
      return NextResponse.json({ ok: false, error: "bot returned non-json", body: text }, { status: 502 });
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

    // positions is an object in your JSON ({}), so count keys
    const positionsObj = data.positions && typeof data.positions === "object" ? data.positions : {};
    const positionsCount = Object.keys(positionsObj).length;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const tsIso = (json.ts ?? new Date().toISOString()) as string;

    // 1) Insert snapshot
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

    // 2) Load previous snapshot so we can diff positions
    const { data: prevRows, error: prevErr } = await supabase
      .from("bot_snapshots")
      .select("raw, ts")
      .order("ts", { ascending: false })
      .limit(2);

    if (prevErr) {
      return NextResponse.json({ ok: false, error: prevErr.message }, { status: 500 });
    }

    const prevRaw = prevRows?.[1]?.raw ?? null; // second newest = previous
    const prevData = prevRaw?.data ?? {};
    const prevPositions =
      prevData.positions && typeof prevData.positions === "object" ? prevData.positions : {};

    const currPositions =
      data.positions && typeof data.positions === "object" ? data.positions : {};

    // 3) Diff positions -> write synthetic fills into bot_fills
    // Dedup: don’t insert the same event twice if pulls repeat while nothing changes.
    const keys = new Set([...Object.keys(prevPositions), ...Object.keys(currPositions)]);

    for (const k of keys) {
      const prev = (prevPositions as any)[k] ?? null;
      const curr = (currPositions as any)[k] ?? null;

      const prevQty = prev ? num0(prev.qty) : 0;
      const currQty = curr ? num0(curr.qty) : 0;

      // Prefer option_symbol so options are unique
      const symbol = (curr?.option_symbol ?? prev?.option_symbol ?? k) as string;

      const side = curr?.side ?? prev?.side ?? null;

      const entryPrice = curr?.entry_price ?? prev?.entry_price ?? null;
      const markPrice = curr?.mark ?? prev?.mark ?? null;

      // Use symbol as stable position_id (contract string is perfect)
      const position_id = symbol;

      // OPEN
      if (prevQty === 0 && currQty > 0) {
        const meta = {
          source: "pull",
          entry_time: curr?.entry_time ?? null,
          tv_close_hint: curr?.tv_close_hint ?? null,
        };

        const dedupe_key = eventKey(["OPEN", position_id, currQty, entryPrice ?? markPrice, tsIso]);

        // Check if we've already inserted this exact event recently
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
            meta: { ...meta, dedupe_key },
          });
        }
      }

      // CLOSE
      if (prevQty > 0 && currQty === 0) {
        const meta = {
          source: "pull",
          tv_close_hint: prev?.tv_close_hint ?? null,
          prev_entry_time: prev?.entry_time ?? null,
        };

        const dedupe_key = eventKey(["CLOSE", position_id, prevQty, markPrice ?? entryPrice, tsIso]);

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
            realized_pnl: null, // not available per-trade from this API
            meta: { ...meta, dedupe_key },
          });
        }
      }

      // ADD / TRIM
      if (prevQty > 0 && currQty > 0 && currQty !== prevQty) {
        const event_type = currQty > prevQty ? "ADD" : "TRIM";
        const deltaQty = Math.abs(currQty - prevQty);

        const dedupe_key = eventKey([event_type, position_id, deltaQty, markPrice ?? entryPrice, tsIso]);

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
            meta: { source: "pull", prevQty, currQty, dedupe_key },
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      inserted: { equity, cash, open_pnl: openPnl, realized_pnl: realizedPnl, positions_count: positionsCount },
      derived_fills: true,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "unknown error" }, { status: 500 });
  }
}