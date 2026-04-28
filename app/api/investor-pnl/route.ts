import { NextRequest, NextResponse } from "next/server";
import { getInvestorPnlData } from "@/lib/getInvestorPnlData";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireApprovedApiUser(req);
  if ("error" in auth) return auth.error;

  try {
    const data = await getInvestorPnlData();
    return auth.applyCookies(NextResponse.json({ ok: true, data }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load investor P/L data.";
    return auth.applyCookies(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
