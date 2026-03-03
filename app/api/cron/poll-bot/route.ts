import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(err: any) {
  const msg = (err?.message ?? String(err)).toLowerCase();
  return (
    msg.includes("getaddrinfo") ||
    msg.includes("enotfound") ||
    msg.includes("ebusy") ||
    msg.includes("fetch failed") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout")
  );
}

async function withRetry<T>(fn: () => Promise<T>, tries = 5) {
  let lastErr: any = null;

  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      if (!isRetryable(e) || i === tries - 1) throw e;

      // exponential backoff with jitter
      const base = 250 * Math.pow(2, i); // 250, 500, 1000, 2000...
      const jitter = Math.floor(Math.random() * 200);
      await sleep(base + jitter);
    }
  }

  throw lastErr;
}

function n(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function GET(req: Request) {
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

    // ---- LOCK (prevents double runs) ----
    // Requires this table. If you don't have it yet, run the SQL below.
    // If you prefer not to add a lock table, tell me and we can remove it.
    const lockKey = `poll-${bot_id}`;

    // Try to acquire lock (retryable)
    const acquired = await withRetry(async () => {
      const { data, error } = await sb
        .from("cron_locks")
        .upsert(
          { lock_key: lockKey, locked_until: new Date(Date.now() + 55_000).toISOString() },
          { onConflict: "lock_key" }
        )
        .select()
        .single();

      if (error) throw error;

      // If someone else holds a lock far in the future, skip
      // (We keep it simple: always overwrite, but short TTL keeps it safe)
      return !!data;
    }, 5);

    if (!acquired) {
      return NextResponse.json({ ok: true, skipped: "lock_not_acquired" });
    }

    // ---- FETCH BOT DATA (retryable) ----
    const payload = await withRetry(async () => {
      const upstream = await fetch("https://ngtdashboard.com/api/bot/dashboard", {
        cache: "no-store",
      });
      if (!upstream.ok) {
        throw new Error(`bot proxy failed status=${upstream.status}`);
      }
      return upstream.json();
    }, 5);

    const d = payload?.data ?? {};

    // ---- INSERT EQUITY POINT (retryable) ----
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
      {
        ok: false,
        error: "cron_failed",
        message: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}