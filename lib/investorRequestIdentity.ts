import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ProfileIdentityRow = {
  role: string | null;
  approved: boolean | null;
  email?: string | null;
  investor_member_id?: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => clean(value))
        .filter((value) => value.length > 0)
    )
  );
}

export async function resolveInvestorRequestIdentity(user: User) {
  const admin = getSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("role, approved, email, investor_member_id")
    .eq("id", user.id)
    .maybeSingle();

  const profileRow = profile as ProfileIdentityRow | null;
  const isAdmin =
    profileRow?.approved === true &&
    String(profileRow.role ?? "").toLowerCase() === "admin";

  const submitterLabel =
    clean(user.user_metadata?.full_name) ||
    clean(user.user_metadata?.name) ||
    clean(profileRow?.email) ||
    clean(user.email) ||
    "Unknown user";

  let investorMemberId = clean(profileRow?.investor_member_id);
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

  if (!investorMemberId) {
    const candidateNames = uniqueStrings([
      user.user_metadata?.full_name,
      user.user_metadata?.name,
    ]);

    if (candidateNames.length > 0) {
      const { data: matches } = await admin
        .from("investor_members")
        .select("id, name")
        .eq("active", true)
        .in("name", candidateNames);

      const activeMatches = ((matches as Array<{ id?: string | null; name?: string | null }> | null) ?? [])
        .map((row) => ({
          id: clean(row.id),
          name: clean(row.name),
        }))
        .filter((row) => row.id && row.name);

      if (activeMatches.length === 1) {
        investorMemberId = activeMatches[0].id;
        matchedMemberName = activeMatches[0].name;

        await admin
          .from("profiles")
          .update({ investor_member_id: investorMemberId } as never)
          .eq("id", user.id);
      }
    }
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
