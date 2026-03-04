import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = process.env.BOT_DASHBOARD_UPSTREAM ?? "https://dashboard.ngtdashboard.com";

export async function GET() {
  try {
    const res = await fetch(`${UPSTREAM}/api/dashboard`, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "Upstream bot dashboard failed", status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}