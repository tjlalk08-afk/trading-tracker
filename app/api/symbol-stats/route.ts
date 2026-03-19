import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireApprovedApiUser(req);
  if ("error" in auth) return auth.error;

  const { data, error } = await supabaseAdmin
    .from("symbol_stats")
    .select("*")
    .order("total_realized_pl", { ascending: false });

  if (error) {
    return auth.applyCookies(
      NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    );
  }

  return auth.applyCookies(NextResponse.json({ ok: true, data: data ?? [] }));
}
