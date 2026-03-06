import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const pathname = req.nextUrl.pathname;
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (!isDashboard) return res;

  const { data: userRes } = await supabase.auth.getUser();

  // Not logged in -> send to login (or "/")
  if (!userRes?.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login"; // change to "/" if you want homepage to be login
    return NextResponse.redirect(url);
  }

  // Logged in but not approved -> send to /pending
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", userRes.user.id)
    .single();

  // If profile missing or not approved, block dashboard access
  if (error || !profile?.approved) {
    const url = req.nextUrl.clone();
    url.pathname = "/pending";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};