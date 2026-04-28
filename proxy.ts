import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cleanEnvValue } from "@/lib/env";

function getSupabaseConfig() {
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export async function proxy(req: NextRequest) {
  const config = getSupabaseConfig();

  if (!config) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 }
    );
  }

  const res = NextResponse.next({
    request: req,
  });

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const pathname = req.nextUrl.pathname;
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (!isDashboard) return res;

  function withPendingCookies(response: NextResponse) {
    res.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return withPendingCookies(NextResponse.redirect(url));
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .single();

  if (error || !profile?.approved) {
    const url = req.nextUrl.clone();
    url.pathname = "/pending";
    return withPendingCookies(NextResponse.redirect(url));
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
