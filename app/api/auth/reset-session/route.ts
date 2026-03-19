import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

function buildSupabase(req: NextRequest, res: NextResponse) {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error("Missing Supabase environment variables");
  }

  return createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ canReset: false });
  let supabase;

  try {
    supabase = buildSupabase(req, res);
  } catch {
    return NextResponse.json({ canReset: false, error: "missing_supabase_config" }, { status: 500 });
  }

  const flowCookie = req.cookies.get("reset_password_flow")?.value === "1";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({
    canReset: Boolean(flowCookie && user),
  });
}

export async function DELETE() {
  const res = NextResponse.json({ cleared: true });
  res.cookies.set("reset_password_flow", "", {
    path: "/reset",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return res;
}
