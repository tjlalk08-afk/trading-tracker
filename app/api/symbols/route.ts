import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("symbol_watchlist")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const symbol = String(body.symbol ?? "")
    .trim()
    .toUpperCase();

  if (!symbol) {
    return badRequest("symbol required");
  }

  const valid = /^[A-Z0-9._-]+$/.test(symbol);
  if (!valid) {
    return badRequest("invalid symbol");
  }

  const { data, error } = await supabaseAdmin
    .from("symbol_watchlist")
    .upsert(
      {
        symbol,
        enabled: true,
      },
      { onConflict: "symbol" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = body.id;

  if (id === undefined || id === null || String(id).trim() === "") {
    return badRequest("id required");
  }

  const update: Record<string, any> = {};

  if (typeof body.enabled === "boolean") {
    update.enabled = body.enabled;
  }

  if (typeof body.notes === "string") {
    update.notes = body.notes.trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return badRequest("nothing to update");
  }

  const { data, error } = await supabaseAdmin
    .from("symbol_watchlist")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return badRequest("id required");
  }

  const { error } = await supabaseAdmin
    .from("symbol_watchlist")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}