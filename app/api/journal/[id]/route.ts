import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  TradeJournalDetailRow,
  TradeJournalNoteRow,
  TradeJournalScreenshotRow,
} from "@/lib/tradeJournal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const admin = getSupabaseAdmin();

    const [tradeResult, notesResult, screenshotsResult] = await Promise.all([
      admin
        .from("trade_journal_trades")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("trade_journal_notes")
        .select("id, note_type, title, body, mood, lesson, created_at")
        .eq("trade_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("trade_journal_screenshots")
        .select("id, image_url, caption, shot_type, created_at")
        .eq("trade_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (tradeResult.error) {
      return NextResponse.json(
        { ok: false, error: `Failed to load trade detail: ${tradeResult.error.message}` },
        { status: 500 },
      );
    }

    if (notesResult.error) {
      return NextResponse.json(
        { ok: false, error: `Failed to load trade notes: ${notesResult.error.message}` },
        { status: 500 },
      );
    }

    if (screenshotsResult.error) {
      return NextResponse.json(
        { ok: false, error: `Failed to load trade screenshots: ${screenshotsResult.error.message}` },
        { status: 500 },
      );
    }

    const trade = tradeResult.data as TradeJournalDetailRow | null;
    if (!trade) {
      return NextResponse.json(
        { ok: false, error: "Trade not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      trade,
      notes: (notesResult.data ?? []) as TradeJournalNoteRow[],
      screenshots: (screenshotsResult.data ?? []) as TradeJournalScreenshotRow[],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected journal detail error",
      },
      { status: 500 },
    );
  }
}
