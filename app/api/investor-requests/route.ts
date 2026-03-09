import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const member_id = body?.member_id;
    const request_type = body?.request_type;
    const amount = body?.amount ?? null;
    const target_member_id = body?.target_member_id ?? null;
    const note = body?.note ?? null;

    if (!member_id) {
      return NextResponse.json({ error: "member_id is required" }, { status: 400 });
    }

    if (!["deposit", "withdrawal", "transfer"].includes(request_type)) {
      return NextResponse.json({ error: "Invalid request_type" }, { status: 400 });
    }

    if (
      (request_type === "deposit" || request_type === "withdrawal") &&
      (!amount || Number(amount) <= 0)
    ) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    if (request_type === "transfer" && !target_member_id) {
      return NextResponse.json(
        { error: "target_member_id is required for transfers" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    const { error } = await supabase.from("investor_requests").insert({
      member_id,
      request_type,
      amount,
      target_member_id,
      note,
      status: "pending",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}