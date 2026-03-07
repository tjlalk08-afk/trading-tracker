import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SNAPSHOT_TABLE = "dashboard_snapshots"; // change this if your table name is different
const TARGET_TIMEZONE = "America/Chicago";
const TARGET_HOUR = 11;
const INGEST_PATH = "/api/ingest/brother-dashboard";

type RecentSnapshotRow = {
  id?: string | number;
  created_at?: string | null;
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

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
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

  // Only run during the 11 AM CT hour unless force=1
  if (!force && chicagoNow.hour !== TARGET_HOUR) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "not-11am-chicago",
      chicagoNow,
      todayChicago,
    });
  }

  // Look back 48h and see whether any snapshot already exists for today's Chicago date
  const sinceIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from(SNAPSHOT_TABLE)
    .select("id, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "failed-to-check-existing-snapshots",
        details: error.message,
      },
      { status: 500 }
    );
  }

  const recent = (data ?? []) as RecentSnapshotRow[];

  const alreadyHaveToday = recent.some((row) => {
    if (!row.created_at) return false;
    return chicagoDateKey(new Date(row.created_at)) === todayChicago;
  });

  if (!force && alreadyHaveToday) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "snapshot-already-exists-for-today",
      todayChicago,
    });
  }

  // Reuse your existing ingest route so manual refresh and cron share the same pipeline
  const ingestUrl = new URL(INGEST_PATH, request.nextUrl.origin);

  const ingestRes = await fetch(ingestUrl.toString(), {
    method: "POST", // change to GET if your ingest route currently uses GET
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
      "x-cron-run": "1",
    },
    cache: "no-store",
    body: JSON.stringify({
      source: "vercel-cron",
      reason: "11am-ct-auto-backfill",
    }),
  });

  const rawText = await ingestRes.text();
  const parsed = safeParseJson(rawText);

  if (!ingestRes.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "ingest-route-failed",
        status: ingestRes.status,
        response: parsed,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    ran: true,
    todayChicago,
    chicagoNow,
    ingestResponse: parsed,
  });
}