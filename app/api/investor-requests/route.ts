import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveInvestorRequestIdentity } from "@/lib/investorRequestIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_REQUEST_TYPES = new Set(["Deposit", "Withdrawal", "Transfer"]);

type InvestorRequestRow = {
  id: string;
  member_id?: string | null;
  member_name: string | null;
  request_type: string | null;
  amount: number | string | null;
  status: string | null;
  created_at: string | null;
  note: string | null;
  target_member_id?: string | null;
  to_member_name: string | null;
  created_by: string | null;
};

type MemberLookupRow = {
  id: string;
  name: string | null;
};

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "-";

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

async function findActiveMemberById(memberId: string | null) {
  if (!memberId) return null;

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("investor_members")
    .select("id, name")
    .eq("id", memberId)
    .eq("active", true)
    .maybeSingle();

  return (data as MemberLookupRow | null) ?? null;
}

async function findActiveMemberByName(memberName: string | null) {
  const name = typeof memberName === "string" ? memberName.trim() : "";
  if (!name) return null;

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("investor_members")
    .select("id, name")
    .eq("name", name)
    .eq("active", true)
    .maybeSingle();

  return (data as MemberLookupRow | null) ?? null;
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

    const requestedMemberId =
      typeof body?.memberId === "string" && body.memberId.trim().length > 0
        ? body.memberId.trim()
        : null;
    const requestedMemberName = String(body?.memberName || "").trim();
    const requestType = String(body?.requestType || "").trim();
    const amount = Number(body?.amount);
    const requestedTargetMemberId =
      typeof body?.targetMemberId === "string" && body.targetMemberId.trim().length > 0
        ? body.targetMemberId.trim()
        : null;
    const requestedTargetMemberName =
      typeof body?.transferToMember === "string" && body.transferToMember.trim().length > 0
        ? body.transferToMember.trim()
        : null;
    const note =
      typeof body?.note === "string" && body.note.trim().length > 0
        ? body.note.trim()
        : null;

    const member =
      (await findActiveMemberById(identity.isAdmin ? requestedMemberId : identity.investorMemberId)) ??
      (identity.isAdmin ? await findActiveMemberByName(requestedMemberName) : null);

    if (!member) {
      return NextResponse.json(
        {
          error: identity.isAdmin
            ? "Choose a valid active member."
            : "Your account is not linked to an investor member yet.",
        },
        { status: 400 }
      );
    }

    if (!identity.isAdmin) {
      if (requestedMemberId && requestedMemberId !== member.id) {
        return NextResponse.json({ error: "Choose a valid active member." }, { status: 400 });
      }

      if (requestedMemberName && requestedMemberName !== member.name) {
        return NextResponse.json({ error: "Choose a valid active member." }, { status: 400 });
      }
    }

    if (!VALID_REQUEST_TYPES.has(requestType)) {
      return NextResponse.json({ error: "Invalid request type." }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0." }, { status: 400 });
    }

    let transferTarget: MemberLookupRow | null = null;

    if (requestType === "Transfer") {
      transferTarget =
        (await findActiveMemberById(requestedTargetMemberId)) ??
        (await findActiveMemberByName(requestedTargetMemberName));

      if (!transferTarget) {
        return NextResponse.json({ error: "Transfer To is required." }, { status: 400 });
      }

      if (transferTarget.id === member.id) {
        return NextResponse.json(
          { error: "Transfer To must be a different member." },
          { status: 400 }
        );
      }
    }

    const { data: insertedRequest, error: insertError } = await admin
      .from("investor_requests")
      .insert({
        member_id: member.id,
        member_name: member.name,
        request_type: requestType,
        amount,
        note,
        status: "Pending",
        created_by: user.id,
        target_member_id: requestType === "Transfer" ? transferTarget?.id ?? null : null,
        to_member_name: requestType === "Transfer" ? transferTarget?.name ?? null : null,
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
