import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!process.env.BOT_API_TOKEN || token !== process.env.BOT_API_TOKEN) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const botUrl = process.env.BOT_DASHBOARD_URL;
  if (!botUrl) {
    return NextResponse.json({ ok: false, error: "BOT_DASHBOARD_URL missing" }, { status: 500 });
  }

  const r = await fetch(botUrl, { cache: "no-store" });
  const text = await r.text();

  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: `bot fetch failed: ${r.status}`, body: text },
      { status: 502 }
    );
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, error: "bot returned non-json", body: text },
      { status: 502 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("bot_snapshots").insert({
    ts: new Date().toISOString(),
    raw: data,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
