import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  summarizeJournal,
  type TradeJournalOverviewRow,
} from "@/lib/tradeJournal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function daysFromRange(range: string) {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 365;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const range = (url.searchParams.get("range") ?? "30d").toLowerCase();
    const account = (url.searchParams.get("account") ?? "all").toLowerCase();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysFromRange(range));

    let query = getSupabaseAdmin()
      .from("trade_journal_overview")
      .select("*")
      .gte("closed_at", cutoff.toISOString())
      .order("closed_at", { ascending: false })
      .limit(250);

    if (account !== "all") {
      query = query.eq("account", account);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to load trade journal: ${error.message}`,
        },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as TradeJournalOverviewRow[];
    return NextResponse.json({
      ok: true,
      range,
      account,
      summary: summarizeJournal(rows),
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected journal route error",
      },
      { status: 500 },
    );
  }
}
