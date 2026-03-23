import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnapshotHistoryRow = {
  snapshot_ts: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export async function GET(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireApprovedApiUser>> | null = null;
  try {
    auth = await requireApprovedApiUser(req);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") ?? "");
    const limit = clamp(Number(searchParams.get("limit") ?? "2000"), 1, 5000);
    const before = searchParams.get("before");

    let query = getSupabaseAdmin()
      .from("dashboard_snapshots")
      .select(`
        id,
        snapshot_ts,
        cash,
        realized_pl,
        open_pl,
        total_pl,
        equity,
        live_cash,
        live_realized_pl,
        live_open_pl,
        live_total_pl,
        live_equity,
        test_cash,
        test_realized_pl,
        test_open_pl,
        test_total_pl,
        test_equity,
        created_at
      `)
      .order("snapshot_ts", { ascending: true })
      .limit(limit + 1);

    if (Number.isFinite(days) && days > 0) {
      const start = new Date();
      start.setDate(start.getDate() - days);
      query = query.gte("snapshot_ts", start.toISOString());
    }

    if (before) {
      query = query.lt("snapshot_ts", before);
    }

    const { data, error } = await query;

    if (error) {
      return auth.applyCookies(
        NextResponse.json(
          { ok: false, error: `Failed to load dashboard history: ${error.message}` },
          { status: 500 },
        )
      );
    }

    const rows = (data ?? []) as SnapshotHistoryRow[];
    const hasMore = rows.length > limit;
    const trimmedRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && trimmedRows.length
        ? trimmedRows[0]?.snapshot_ts ?? null
        : null;

    return auth.applyCookies(
      NextResponse.json({
        ok: true,
        data: trimmedRows,
        has_more: hasMore,
        next_cursor: nextCursor,
      })
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown dashboard-history error";

    const response = NextResponse.json({ ok: false, error: message }, { status: 500 });
    return auth && !("error" in auth) ? auth.applyCookies(response) : response;
  }
}
