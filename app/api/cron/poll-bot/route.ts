import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBotDashboardUrl } from "@/lib/botDashboardUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;
const TARGET_TIMEZONE = "America/Chicago";
const TARGET_HOUR = 10;
const TARGET_MINUTE = 45;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function msg(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isRetryable(error: unknown) {
  const m = msg(error).toLowerCase();
  return (
    m.includes("getaddrinfo") ||
    m.includes("enotfound") ||
    m.includes("ebusy") ||
    m.includes("fetch failed") ||
    m.includes("timeout") ||
    m.includes("econnreset") ||
    m.includes("etimedout")
  );
}

async function withRetry<T>(fn: () => Promise<T>, tries = 5) {
  let last: unknown = null;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      last = error;
      if (!isRetryable(error) || i === tries - 1) throw error;
      const base = 250 * Math.pow(2, i);
      const jitter = Math.floor(Math.random() * 200);
      await sleep(base + jitter);
    }
  }
  throw last;
}

function n(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function readCronSecret(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const { searchParams } = new URL(req.url);
  return searchParams.get("secret");
}

function getChicagoParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TARGET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: map.weekday,
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export async function GET(req: Request) {
  const stage = { at: "START" as string };

  try {
    const secret = readCronSecret(req);
    const force = new URL(req.url).searchParams.get("force") === "1";

    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const chicagoNow = getChicagoParts();
    const isWeekday = chicagoNow.weekday !== "Sat" && chicagoNow.weekday !== "Sun";
    const isTargetTime =
      chicagoNow.hour === TARGET_HOUR && chicagoNow.minute === TARGET_MINUTE;

    if (!force && (!isWeekday || !isTargetTime)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "outside-target-window",
        chicagoNow,
        target: {
          timezone: TARGET_TIMEZONE,
          hour: TARGET_HOUR,
          minute: TARGET_MINUTE,
        },
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "missing supabase env vars" },
        { status: 500 }
      );
    }

    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const bot_id = "ngt-bot";
    const nowIso = new Date().toISOString();

    // ---- LOCK ----
    stage.at = "LOCK";
    await withRetry(async () => {
      const { error } = await sb
        .from("cron_locks")
        .upsert(
          { lock_key: `poll-${bot_id}`, locked_until: new Date(Date.now() + 55_000).toISOString() },
          { onConflict: "lock_key" }
        );
      if (error) throw error;
      return true;
    }, 5);

    // ---- BOT FETCH ----
    stage.at = "BOT_FETCH";
    const payload = await withRetry<JsonRecord>(async () => {
      const r = await fetch(getBotDashboardUrl(), {
        cache: "no-store",
        headers: {
          accept: "application/json",
        },
      });
      if (!r.ok) throw new Error(`bot proxy failed status=${r.status}`);
      return (await r.json()) as JsonRecord;
    }, 5);

    const d =
      typeof payload.data === "object" && payload.data !== null
        ? (payload.data as JsonRecord)
        : {};

    // ---- SUPABASE INSERT ----
    stage.at = "SUPABASE_INSERT";
    await withRetry(async () => {
      const { error } = await sb.from("bot_equity_points").insert({
        bot_id,
        ts: nowIso,
        updated_text: d.updated ?? null,
        cash: n(d.cash),
        equity: n(d.equity),
        live_realized_pnl: n(d.live_realized_pnl),
        live_open_pnl: n(d.live_open_pnl),
        live_total_pnl: n(d.live_total_pnl),
        test_cash: n(d.test_cash),
        test_equity: n(d.test_equity),
        test_realized_pnl: n(d.test_realized_pnl),
        test_open_pnl: n(d.test_open_pnl),
        test_total_pnl: n(d.test_total_pnl),
      });
      if (error) throw error;
      return true;
    }, 5);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: "cron_failed", stage: stage.at, message: msg(error) },
      { status: 500 }
    );
  }
}
