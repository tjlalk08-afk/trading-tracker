import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rangeFromDays(days: number) {
  if (days <= 7) return "7d";
  if (days <= 30) return "30d";
  return "1y";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") || "30");
  const range = rangeFromDays(days);
  const url = new URL(`/api/symbols?range=${range}`, req.url);

  return NextResponse.redirect(url, { status: 307 });
}
