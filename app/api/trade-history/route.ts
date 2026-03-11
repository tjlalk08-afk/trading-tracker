import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Supabase env vars are missing. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("trade_history")
      .select(
        [
          "id",
          "snapshot_date",
          "trade_day",
          "symbol",
          "side",
          "qty",
          "entry_price",
          "exit_price",
          "realized_pl",
          "opened_at",
          "closed_at",
          "source",
          "external_trade_id",
        ].join(",")
      )
      .order("closed_at", { ascending: false })
      .order("trade_day", { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to load trade history: ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: data ?? [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unexpected trade history error",
      },
      { status: 500 }
    );
  }
}