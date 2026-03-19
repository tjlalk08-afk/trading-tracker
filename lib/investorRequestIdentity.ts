import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ProfileIdentityRow = {
  role: string | null;
  approved: boolean | null;
  name?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  investor_member_id?: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function resolveInvestorRequestIdentity(user: User) {
  const admin = getSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("role, approved, name, full_name, display_name, investor_member_id")
    .eq("id", user.id)
    .maybeSingle();

  const profileRow = profile as ProfileIdentityRow | null;
  const isAdmin =
    profileRow?.approved === true &&
    String(profileRow.role ?? "").toLowerCase() === "admin";

  const submitterLabel =
    clean(profileRow?.full_name) ||
    clean(profileRow?.display_name) ||
    clean(profileRow?.name) ||
    clean(user.user_metadata?.full_name) ||
    clean(user.user_metadata?.name) ||
    clean(user.email) ||
    "Unknown user";

  const investorMemberId = clean(profileRow?.investor_member_id);
  let matchedMemberName: string | null = null;

  if (investorMemberId) {
    const { data: member } = await admin
      .from("investor_members")
      .select("name")
      .eq("id", investorMemberId)
      .eq("active", true)
      .maybeSingle();

    matchedMemberName = clean((member as { name?: string | null } | null)?.name) || null;
  }

  return {
    isAdmin,
    submitterLabel,
    investorMemberId: investorMemberId || null,
    matchedMemberName,
  };
}

export async function getSubmitterLabelsByUserId(userIds: Array<string | null | undefined>) {
  const admin = getSupabaseAdmin();
  const labels = new Map<string, string>();

  for (const rawId of userIds) {
    const userId = clean(rawId);
    if (!userId || labels.has(userId)) continue;

    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) {
      labels.set(userId, userId);
      continue;
    }

    const user = data.user;
    const label =
      clean(user.user_metadata?.full_name) ||
      clean(user.user_metadata?.name) ||
      clean(user.email) ||
      userId;

    labels.set(userId, label);
  }

  return labels;
}
