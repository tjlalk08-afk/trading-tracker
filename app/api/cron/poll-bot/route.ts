import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function msg(e: any) {
  return e?.message ?? String(e);
}

function isRetryable(err: any) {
  const m = msg(err).toLowerCase();
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
  let last: any = null;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      last = e;
      if (!isRetryable(e) || i === tries - 1) throw e;
      const base = 250 * Math.pow(2, i);
      const jitter = Math.floor(Math.random() * 200);
      await sleep(base + jitter);
    }
  }
  throw last;
}

function n(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function GET(req: Request) {
  const stage = { at: "START" as string };

  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
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
    const payload = await withRetry(async () => {
      const r = await fetch("https://ngtdashboard.com/api/bot/dashboard", { cache: "no-store" });
      if (!r.ok) throw new Error(`bot proxy failed status=${r.status}`);
      return r.json();
    }, 5);

    const d = payload?.data ?? {};

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
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "cron_failed", stage: stage.at, message: msg(e) },
      { status: 500 }
    );
  }
}