import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";

export async function requireAdminApiUser(req: NextRequest) {
  const auth = await requireApprovedApiUser(req);
  if ("error" in auth) {
    return auth;
  }

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, approved")
    .eq("id", auth.user.id)
    .maybeSingle();
  const profileRow = profile as { role: string | null; approved: boolean | null } | null;

  if (profileError) {
    return {
      applyCookies: auth.applyCookies,
      error: auth.applyCookies(
        NextResponse.json(
          { ok: false, error: `Failed to load admin profile: ${profileError.message}` },
          { status: 500 },
        ),
      ),
    };
  }

  const isAdmin =
    profileRow?.approved === true &&
    String(profileRow.role ?? "").toLowerCase() === "admin";

  if (!isAdmin) {
    return {
      applyCookies: auth.applyCookies,
      error: auth.applyCookies(
        NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }),
      ),
    };
  }

  return auth;
}
