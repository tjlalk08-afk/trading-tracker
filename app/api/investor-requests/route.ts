import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveInvestorRequestIdentity } from "@/lib/investorRequestIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_REQUEST_TYPES = new Set(["Deposit", "Withdrawal", "Transfer"]);

type InvestorRequestRow = {
  id: string;
  member_name: string | null;
  request_type: string | null;
  amount: number | string | null;
  status: string | null;
  created_at: string | null;
  note: string | null;
  to_member_name: string | null;
  created_by: string | null;
};

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

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const admin = getSupabaseAdmin();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json(
        { error: userError.message || "Failed to read auth user." },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const identity = await resolveInvestorRequestIdentity(user);

    const body = await req.json();

    const requestedMemberName = String(body?.memberName || "").trim();
    const requestType = String(body?.requestType || "").trim();
    const amount = Number(body?.amount);
    const transferToMember =
      typeof body?.transferToMember === "string" && body.transferToMember.trim().length > 0
        ? body.transferToMember.trim()
        : null;
    const note =
      typeof body?.note === "string" && body.note.trim().length > 0
        ? body.note.trim()
        : null;

    const memberName = identity.isAdmin
      ? requestedMemberName
      : identity.matchedMemberName ?? "";

    if (!memberName) {
      return NextResponse.json(
        {
          error: identity.isAdmin
            ? "Member name is required."
            : "Your account is not linked to an investor member yet.",
        },
        { status: 400 }
      );
    }

    if (!identity.isAdmin && requestedMemberName && requestedMemberName !== memberName) {
      return NextResponse.json({ error: "Member name is required." }, { status: 400 });
    }

    if (!VALID_REQUEST_TYPES.has(requestType)) {
      return NextResponse.json({ error: "Invalid request type." }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0." }, { status: 400 });
    }

    if (requestType === "Transfer") {
      if (!transferToMember) {
        return NextResponse.json({ error: "Transfer To is required." }, { status: 400 });
      }

      if (transferToMember === memberName) {
        return NextResponse.json(
          { error: "Transfer To must be a different member." },
          { status: 400 }
        );
      }
    }

    const { data: insertedRequest, error: insertError } = await admin
      .from("investor_requests")
      .insert({
        member_name: memberName,
        request_type: requestType,
        amount,
        note,
        status: "Pending",
        created_by: user.id,
        to_member_name: requestType === "Transfer" ? transferToMember : null,
      } as never)
      .select("*")
      .single();

    if (insertError || !insertedRequest) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create request." },
        { status: 500 }
      );
    }

    const insertedRequestRow = insertedRequest as InvestorRequestRow | null;

    const { error: auditError } = await admin.from("investor_request_audit_log").insert({
      request_id: insertedRequestRow?.id,
      action: "CREATED",
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      snapshot: insertedRequestRow,
    } as never);

    if (auditError) {
      return NextResponse.json(
        { error: auditError.message || "Failed to write audit log." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      request: {
        id: insertedRequestRow?.id,
        member: insertedRequestRow?.member_name,
        submittedBy: identity.submitterLabel,
        type: insertedRequestRow?.request_type,
        amount: Number(insertedRequestRow?.amount ?? 0),
        status: insertedRequestRow?.status,
        createdAt: formatDisplayDate(insertedRequestRow?.created_at),
        note: insertedRequestRow?.note ?? undefined,
        transferTo: insertedRequestRow?.to_member_name ?? undefined,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
