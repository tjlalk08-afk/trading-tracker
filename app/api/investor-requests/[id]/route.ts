import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUND_EQUITY = 7691.68;
const TOTAL_UNITS = 10000;
const UNIT_PRICE = FUND_EQUITY / TOTAL_UNITS;

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const supabase = await supabaseServer();
    const admin = getSupabaseAdmin();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role, approved")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.role === "admin" && profile?.approved === true;

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const action = String(body?.action || "").trim();

    if (action !== "approve" && action !== "decline") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const { data: existingRequest, error: existingError } = await admin
      .from("investor_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    if (existingRequest.status !== "Pending") {
      return NextResponse.json(
        { error: "Only pending requests can be updated." },
        { status: 400 }
      );
    }

    if (action === "decline") {
      const { data: declinedRequest, error: declineError } = await admin
        .from("investor_requests")
        .update({
          status: "Declined",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (declineError || !declinedRequest) {
        return NextResponse.json(
          { error: declineError?.message || "Failed to decline request." },
          { status: 500 }
        );
      }

      await admin.from("investor_request_audit_log").insert({
        request_id: declinedRequest.id,
        action: "DECLINED",
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        snapshot: declinedRequest,
      });

      return NextResponse.json({
        ok: true,
        request: {
          id: declinedRequest.id,
          member: declinedRequest.member_name,
          type: declinedRequest.request_type,
          amount: Number(declinedRequest.amount ?? 0),
          status: declinedRequest.status,
          createdAt: formatDisplayDate(declinedRequest.created_at),
          note: declinedRequest.note ?? undefined,
          transferTo: declinedRequest.to_member_name ?? undefined,
        },
      });
    }

    const nowIso = new Date().toISOString();

    const { data: completedRequest, error: approveError } = await admin
      .from("investor_requests")
      .update({
        status: "Completed",
        reviewed_by: user.id,
        reviewed_at: nowIso,
        completed_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (approveError || !completedRequest) {
      return NextResponse.json(
        { error: approveError?.message || "Failed to approve request." },
        { status: 500 }
      );
    }

    const { data: postedTransaction, error: postedError } = await admin
      .from("investor_posted_transactions")
      .insert({
        request_id: completedRequest.id,
        member_name: completedRequest.member_name,
        transaction_type: completedRequest.request_type,
        amount: completedRequest.amount,
        units: Number(completedRequest.amount ?? 0) / UNIT_PRICE,
        posted_by: user.id,
        to_member_name: completedRequest.to_member_name ?? null,
      })
      .select("*")
      .single();

    if (postedError || !postedTransaction) {
      return NextResponse.json(
        { error: postedError?.message || "Failed to create posted transaction." },
        { status: 500 }
      );
    }

    await admin.from("investor_request_audit_log").insert({
      request_id: completedRequest.id,
      action: "APPROVED",
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      snapshot: {
        request: completedRequest,
        postedTransaction,
      },
    });

    return NextResponse.json({
      ok: true,
      request: {
        id: completedRequest.id,
        member: completedRequest.member_name,
        type: completedRequest.request_type,
        amount: Number(completedRequest.amount ?? 0),
        status: completedRequest.status,
        createdAt: formatDisplayDate(completedRequest.created_at),
        note: completedRequest.note ?? undefined,
        transferTo: completedRequest.to_member_name ?? undefined,
      },
      postedTransaction: {
        member: postedTransaction.member_name,
        type: postedTransaction.transaction_type,
        amount: Number(postedTransaction.amount ?? 0),
        units: Number(postedTransaction.units ?? 0),
        when: formatDisplayDate(postedTransaction.posted_at),
        transferTo: postedTransaction.to_member_name ?? undefined,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}