import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("dashboard_snapshots")
      .select("*")
      .order("snapshot_ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: `Failed to load latest snapshot: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown dashboard-latest error";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
