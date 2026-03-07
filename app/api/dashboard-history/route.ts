import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("dashboard_snapshots")
    .select(
      "id, snapshot_ts, equity, live_equity, test_equity, total_pl, live_total_pl, test_total_pl, created_at"
    )
    .order("snapshot_ts", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}