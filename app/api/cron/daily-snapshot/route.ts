// app/api/cron/daily-snapshot/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_TIMEZONE = "America/Chicago";
const INGEST_PATH = "/api/ingest/brother-dashboard";

type JsonRecord = Record<string, unknown>;

type BotSnapshotRow = {
  ts: string | null;
  raw: JsonRecord | null;
};

type BotEquityPointRow = {
  ts: string | null;
  updated_text: string | null;
  cash: number | null;
  equity: number | null;
  live_realized_pnl: number | null;
  live_open_pnl: number | null;
  live_total_pnl: number | null;
  test_cash: number | null;
  test_equity: number | null;
  test_realized_pnl: number | null;
  test_open_pnl: number | null;
  test_total_pnl: number | null;
};

function getChicagoParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TARGET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function chicagoDateKey(date = new Date()) {
  const p = getChicagoParts(date);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}

function isChicagoBusinessDay(date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TARGET_TIMEZONE,
    weekday: "short",
  }).format(date);

  return weekday !== "Sat" && weekday !== "Sun";
}

function snapshotChicagoDateKey(snapshotTs: string | null | undefined) {
  if (!snapshotTs) return null;
  return chicagoDateKey(new Date(snapshotTs));
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function toStringValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function toNumberValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimestamp(value: unknown): string | null {
  const raw = toStringValue(value);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.replace(" ", "T");
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function buildSnapshotRowFromPayload(
  upstream: JsonRecord,
  source: string,
  fallbackMeta?: JsonRecord,
) {
  const payload = asRecord(upstream.data);

  const snapshotTs =
    normalizeTimestamp(upstream.ts) ??
    normalizeTimestamp(upstream.snapshot_ts) ??
    new Date().toISOString();

  const updatedText =
    toStringValue(payload.updated) ??
    toStringValue(upstream.updated_text) ??
    null;

  const liveCash = toNumberValue(payload.live_cash) ?? 0;
  const liveRealized = toNumberValue(payload.live_realized_pl) ?? 0;
  const liveOpen = toNumberValue(payload.live_open_pl) ?? 0;
  const liveTotal = toNumberValue(payload.live_total_pl) ?? 0;
  const liveEquity = toNumberValue(payload.live_equity) ?? 0;

  const testCash = toNumberValue(payload.test_cash) ?? 0;
  const testRealized = toNumberValue(payload.test_realized_pl) ?? 0;
  const testOpen = toNumberValue(payload.test_open_pl) ?? 0;
  const testTotal = toNumberValue(payload.test_total_pl) ?? 0;
  const testEquity = toNumberValue(payload.test_equity) ?? 0;

  const cash = toNumberValue(payload.cash) ?? liveCash;
  const realizedPl = toNumberValue(payload.realized_pl) ?? liveRealized + testRealized;
  const openPl = toNumberValue(payload.open_pl) ?? liveOpen + testOpen;
  const totalPl = toNumberValue(payload.total_pl) ?? liveTotal + testTotal;
  const equity = toNumberValue(payload.equity) ?? liveEquity + testEquity;

  return {
    snapshotTs,
    snapshotDate: dateOnly(snapshotTs),
    row: {
      source,
      snapshot_ts: snapshotTs,
      updated_text: updatedText,
      cash,
      realized_pl: realizedPl,
      open_pl: openPl,
      total_pl: totalPl,
      equity,
      live_cash: liveCash,
      live_realized_pl: liveRealized,
      live_open_pl: liveOpen,
      live_total_pl: liveTotal,
      live_equity: liveEquity,
      test_cash: testCash,
      test_realized_pl: testRealized,
      test_open_pl: testOpen,
      test_total_pl: testTotal,
      test_equity: testEquity,
      raw_payload: fallbackMeta
        ? {
            ...upstream,
            fallback_meta: fallbackMeta,
          }
        : upstream,
    },
  };
}

function buildPayloadFromBotEquityPoint(row: BotEquityPointRow): JsonRecord {
  return {
    ts: row.ts,
    updated_text: row.updated_text,
    data: {
      cash: row.cash,
      equity: row.equity,
      live_cash: row.cash,
      live_realized_pl: row.live_realized_pnl,
      live_open_pl: row.live_open_pnl,
      live_total_pl: row.live_total_pnl,
      live_equity: row.equity,
      test_cash: row.test_cash,
      test_realized_pl: row.test_realized_pnl,
      test_open_pl: row.test_open_pnl,
      test_total_pl: row.test_total_pnl,
      test_equity: row.test_equity,
      updated: row.updated_text,
    },
  };
}

async function saveFallbackSnapshotForToday(
  todayChicago: string,
  force: boolean,
) {
  const supabaseAdmin = getSupabaseAdmin();
  const [
    latestBotSnapshotResult,
    latestBotEquityResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("bot_snapshots")
      .select("ts, raw")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("bot_equity_points")
      .select(
        "ts, updated_text, cash, equity, live_realized_pnl, live_open_pnl, live_total_pnl, test_cash, test_equity, test_realized_pnl, test_open_pnl, test_total_pnl",
      )
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (latestBotSnapshotResult.error) {
    throw new Error(`Fallback bot_snapshots lookup failed: ${latestBotSnapshotResult.error.message}`);
  }

  if (latestBotEquityResult.error) {
    throw new Error(`Fallback bot_equity_points lookup failed: ${latestBotEquityResult.error.message}`);
  }

  const candidates: Array<{
    source: string;
    ts: string | null;
    payload: JsonRecord;
    fallbackMeta: JsonRecord;
  }> = [];

  const botSnapshot = latestBotSnapshotResult.data as BotSnapshotRow | null;
  if (botSnapshot?.ts && isRecord(botSnapshot.raw)) {
    candidates.push({
      source: "supabase_bot_snapshot_fallback",
      ts: botSnapshot.ts,
      payload: botSnapshot.raw,
      fallbackMeta: {
        fallback_source: "bot_snapshots",
      },
    });
  }

  const botEquityPoint = latestBotEquityResult.data as BotEquityPointRow | null;
  if (botEquityPoint?.ts) {
    candidates.push({
      source: "supabase_bot_equity_fallback",
      ts: botEquityPoint.ts,
      payload: buildPayloadFromBotEquityPoint(botEquityPoint),
      fallbackMeta: {
        fallback_source: "bot_equity_points",
      },
    });
  }

  if (candidates.length === 0) {
    throw new Error("No persisted bot data available for fallback snapshot");
  }

  candidates.sort((a, b) => {
    const aTs = new Date(a.ts ?? 0).getTime();
    const bTs = new Date(b.ts ?? 0).getTime();
    return bTs - aTs;
  });

  const chosen = candidates[0];
  const chosenChicagoDate = snapshotChicagoDateKey(chosen.ts);

  if (!force && chosenChicagoDate !== todayChicago) {
    throw new Error(
      `Fallback source is stale. Latest persisted bot data is for ${chosenChicagoDate ?? "unknown date"}, not ${todayChicago}`,
    );
  }

  const snapshot = buildSnapshotRowFromPayload(
    chosen.payload,
    chosen.source,
    {
      ...chosen.fallbackMeta,
      fallback_trigger: "daily-cron",
      fallback_for_chicago_date: todayChicago,
      fallback_source_ts: chosen.ts,
    },
  );

  const { data, error } = await supabaseAdmin
    .from("dashboard_snapshots")
    .insert(snapshot.row as never)
    .select("id, snapshot_ts, source, created_at")
    .single();

  if (error) {
    throw new Error(`Fallback snapshot insert failed: ${error.message}`);
  }

  return {
    mode: "fallback",
    source: chosen.source,
    snapshot: data,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : "";

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const force = request.nextUrl.searchParams.get("force") === "1";

  const now = new Date();
  const chicagoNow = getChicagoParts(now);
  const todayChicago = chicagoDateKey(now);
  const businessDay = isChicagoBusinessDay(now);

  if (!force && !businessDay) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "not-business-day-chicago",
      chicagoNow,
      todayChicago,
    });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: latestSnapshot, error: latestSnapshotError } = await supabaseAdmin
    .from("dashboard_snapshots")
    .select("id, snapshot_ts, created_at")
    .order("snapshot_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestSnapshotError) {
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to inspect latest snapshot: ${latestSnapshotError.message}`,
      },
      { status: 500 },
    );
  }

  const latestChicagoDate = snapshotChicagoDateKey(latestSnapshot?.snapshot_ts);
  if (!force && latestChicagoDate === todayChicago) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "snapshot-already-saved-for-chicago-date",
      chicagoNow,
      todayChicago,
      latestSnapshot,
    });
  }

  const ingestUrl = new URL(INGEST_PATH, request.nextUrl.origin);

  const ingestRes = await fetch(ingestUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
      "x-cron-run": "1",
    },
    cache: "no-store",
    body: JSON.stringify({
      source: "vercel-cron",
      reason: "daily-after-close-snapshot",
      forced: force,
      chicagoDate: todayChicago,
      chicagoHour: chicagoNow.hour,
    }),
  });

  const rawText = await ingestRes.text();
  const parsed = safeParseJson(rawText);

  if (!ingestRes.ok) {
    try {
      const fallback = await saveFallbackSnapshotForToday(todayChicago, force);

      return NextResponse.json({
        ok: true,
        ran: true,
        mode: "fallback",
        todayChicago,
        chicagoNow,
        ingestFailure: {
          status: ingestRes.status,
          response: parsed,
        },
        fallback,
      });
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : "Unknown fallback error";

      return NextResponse.json(
        {
          ok: false,
          error: "ingest-and-fallback-failed",
          status: ingestRes.status,
          response: parsed,
          fallbackError: fallbackMessage,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    ran: true,
    mode: "live-ingest",
    todayChicago,
    chicagoNow,
    ingestResponse: parsed,
  });
}
