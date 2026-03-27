import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireApprovedApiUser>> | null = null;
  try {
    auth = await requireApprovedApiUser(req);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get("mode") ?? "live").toLowerCase() === "paper" ? "paper" : "live";

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("dashboard_snapshots")
      .select("*")
      .eq("mode", mode)
      .order("snapshot_ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return auth.applyCookies(
        NextResponse.json(
          { ok: false, error: `Failed to load latest snapshot: ${error.message}` },
          { status: 500 },
        )
      );
    }

    return auth.applyCookies(NextResponse.json({ ok: true, data }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown dashboard-latest error";

    const response = NextResponse.json({ ok: false, error: message }, { status: 500 });
    return auth && !("error" in auth) ? auth.applyCookies(response) : response;
  }
}
