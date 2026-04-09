import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";

export const dynamic = "force-dynamic";

type TradeHistoryRow = {
  closed_at: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function startDateFromRange(range: string) {
  if (range === "all") return null;

  const now = new Date();
  const d = new Date(now);

  if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else d.setFullYear(d.getFullYear() - 1);

  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireApprovedApiUser>> | null = null;
  try {
    auth = await requireApprovedApiUser(req);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") ?? "30d").toLowerCase();
    const limit = clamp(Number(searchParams.get("limit") ?? "500"), 1, 2000);
    const before = searchParams.get("before");
    const modeParam = (searchParams.get("mode") ?? "live").toLowerCase();
    const includeAllModes = modeParam === "all";
    const mode = modeParam === "paper" ? "paper" : "live";
    const startDate = startDateFromRange(range);

    let query = getSupabaseAdmin()
      .from("trade_history")
      .select(
        [
          "id",
          "snapshot_date",
          "trade_day",
          "symbol",
          "side",
          "qty",
          "entry_price",
          "exit_price",
          "realized_pl",
          "opened_at",
          "closed_at",
          "source",
          "mode",
          "external_trade_id",
        ].join(",")
      )
      .order("closed_at", { ascending: false, nullsFirst: false })
      .order("trade_day", { ascending: false })
      .limit(limit + 1);

    if (!includeAllModes) {
      query = query.eq("mode", mode);
    }

    if (startDate) {
      query = query.gte("trade_day", startDate);
    }

    if (before) {
      query = query.lt("closed_at", before);
    }

    const { data, error } = await query;

    if (error) {
      return auth.applyCookies(
        NextResponse.json(
          {
            ok: false,
            error: `Failed to load trade history: ${error.message}`,
          },
          { status: 500 }
        )
      );
    }

    const rows = (data ?? []) as TradeHistoryRow[];
    const hasMore = rows.length > limit;
    const trimmedRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && trimmedRows.length
        ? trimmedRows[trimmedRows.length - 1]?.closed_at ?? null
        : null;

    return auth.applyCookies(
      NextResponse.json({
        ok: true,
        data: trimmedRows,
        has_more: hasMore,
        next_cursor: nextCursor,
      })
    );
  } catch (error: unknown) {
    const response = NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected trade history error",
      },
      { status: 500 }
    );
    return auth && !("error" in auth) ? auth.applyCookies(response) : response;
  }
}
