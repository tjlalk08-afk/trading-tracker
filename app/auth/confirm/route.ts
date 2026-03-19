import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/reset";
  }

  return next;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = getSafeNextPath(url.searchParams.get("next"));

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/?error=missing_token", req.url));
  }

  const response = NextResponse.redirect(new URL(next, req.url));
  const config = getSupabaseConfig();

  if (!config) {
    return NextResponse.redirect(new URL("/?error=missing_supabase_config", req.url));
  }

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/?error=invalid_or_expired_reset_link", req.url)
    );
  }

  if (type === "recovery") {
    response.cookies.set("reset_password_flow", "1", {
      path: "/reset",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10,
    });
  }

  return response;
}
