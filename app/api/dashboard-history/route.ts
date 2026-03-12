import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
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
      .limit(1000);

    if (error) {
      return NextResponse.json(
        { ok: false, error: `Failed to load dashboard history: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown dashboard-history error";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
