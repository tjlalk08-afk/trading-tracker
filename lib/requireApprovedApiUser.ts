import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cleanEnvValue } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function getSupabaseConfig() {
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export async function requireApprovedApiUser(req: NextRequest) {
  const config = getSupabaseConfig();
  const pendingCookies: CookieToSet[] = [];

  function applyCookies(response: NextResponse) {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  if (!config) {
    return {
      applyCookies,
      error: applyCookies(
        NextResponse.json(
          { ok: false, error: "Supabase environment variables are not configured." },
          { status: 500 }
        )
      ),
    };
  }

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          pendingCookies.push(cookie);
        });
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      applyCookies,
      error: applyCookies(
        NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.approved) {
    return {
      applyCookies,
      error: applyCookies(
        NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
      ),
    };
  }

  return { user, applyCookies };
}
