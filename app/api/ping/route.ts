import { NextRequest, NextResponse } from "next/server";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireApprovedApiUser>> | null = null;
  try {
    auth = await requireApprovedApiUser(req);
    if ("error" in auth) return auth.error;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("tv_signals")
      .select("id")
      .limit(1);

    return auth.applyCookies(
      NextResponse.json({
        ok: !error,
        error: error?.message ?? null,
        data,
      })
    );
  } catch (error) {
    const response = NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected ping error",
      },
      { status: 500 }
    );
    return auth && !("error" in auth) ? auth.applyCookies(response) : response;
  }
}
