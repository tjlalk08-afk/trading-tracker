import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Only allow Vercel Cron to call this
  const isCron = req.headers.get("x-vercel-cron");
  if (!isCron) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // Call your existing pull endpoint internally (no token needed here)
  // IMPORTANT: use your production URL
  const base = "https://trading-tracker-seven.vercel.app";
  const r = await fetch(`${base}/api/bot/pull?token=${process.env.BOT_API_TOKEN}`, { cache: "no-store" });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { "content-type": "application/json" } });
}