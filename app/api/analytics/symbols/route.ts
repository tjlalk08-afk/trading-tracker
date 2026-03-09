import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") || "30");

    const sbUrl = process.env.SB_URL;
    const sbKey = process.env.SB_SERVICE_ROLE_KEY;

    if (!sbUrl) {
      return NextResponse.json(
        { error: "Missing SB_URL env var", rows: [] },
        { status: 500 }
      );
    }

    if (!sbKey) {
      return NextResponse.json(
        { error: "Missing SB_SERVICE_ROLE_KEY env var", rows: [] },
        { status: 500 }
      );
    }

    const supabase = createClient(sbUrl, sbKey);

    const from = new Date();
    from.setDate(from.getDate() - days);

    try {
      const { data, error } = await supabase
        .from("trade_history")
        .select("symbol, realized_pl, open_pl, closed_at, status")
        .gte("closed_at", from.toISOString());

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
            details: error,
            rows: [],
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        rows: data ?? [],
      });
    } catch (inner: any) {
      return NextResponse.json(
        {
          error: inner?.message || "Supabase request failed",
          cause: inner?.cause ?? null,
          stack: inner?.stack ?? null,
          sbUrlPreview: sbUrl.slice(0, 40),
          rows: [],
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message || "Unexpected server error",
        cause: err?.cause ?? null,
        stack: err?.stack ?? null,
        rows: [],
      },
      { status: 500 }
    );
  }
}