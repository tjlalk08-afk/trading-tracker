
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_TIMEZONE = "America/Chicago";
const TARGET_HOUR = 10;
const INGEST_PATH = "/api/ingest/brother-dashboard";

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

  // Only run during the 10 AM Chicago hour unless force=1
  if (!force && chicagoNow.hour !== TARGET_HOUR) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "not-10am-chicago",
      chicagoNow,
      todayChicago,
    });
  }

  // Always save a fresh snapshot when it runs
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
      reason: "10am-chicago-daily-snapshot-always-save",
      forced: force,
      chicagoDate: todayChicago,
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