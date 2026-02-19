import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("tv_signals")
    .select("id")
    .limit(1);

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    data,
  });
}
