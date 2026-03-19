import { NextResponse } from "next/server";
import { getBotDashboardUrl } from "@/lib/botDashboardUrl";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;
type PositionRecord = {
  qty?: number | string | null;
  option_symbol?: string | null;
  side?: string | null;
  entry_price?: number | string | null;
  mark?: number | string | null;
};

const asNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const num0 = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const eventKey = (parts: Array<string | number | null | undefined>) =>
  parts.map((p) => (p === null || p === undefined ? "" : String(p))).join("|");

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
}

async function handlePull(req: Request, method: "GET" | "POST") {
  try {
    const token = getBearerToken(req);
    const expected = (process.env.BOT_API_TOKEN ?? "").trim();

    if (!expected || token !== expected) {
      console.warn("[bot/pull] unauthorized request", { method });
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (method === "GET") {
      console.warn("[bot/pull] deprecated GET compatibility path used");
    }

    const r = await fetch(getBotDashboardUrl(), { cache: "no-store" });

    let json: { ok?: boolean; ts?: string; data?: JsonObject } | null = null;
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

    const data: JsonObject = json?.data ?? {};

    const cash = asNum(data.cash);
    const equity = asNum(data.equity);
    const openPnl = asNum(data.open_pnl);
    const realizedPnl = asNum(data.realized_pnl);

    const positionsObj =
      data.positions && typeof data.positions === "object"
        ? data.positions
        : {};
    const positionsCount = Object.keys(positionsObj).length;

    const supabase = getSupabaseAdmin();

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
    } as never);

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

    const prevRaw = (prevRows?.[1] as { raw?: unknown } | undefined)?.raw ?? null;
    const prevData =
      prevRaw && typeof prevRaw === "object" && "data" in prevRaw
        ? (((prevRaw as { data?: unknown }).data as JsonObject | undefined) ?? {})
        : {};
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
      const prev = (prevPositions as Record<string, PositionRecord | null>)[k] ?? null;
      const curr = (currPositions as Record<string, PositionRecord | null>)[k] ?? null;

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
          } as never);
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
          } as never);
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
          } as never);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handlePull(req, "GET");
}

export async function POST(req: Request) {
  return handlePull(req, "POST");
}
