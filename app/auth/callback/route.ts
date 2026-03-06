// app/auth/callback/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // Supabase will redirect here after email confirm / magic links.
  // The supabase-js client can also pick up sessions in URL automatically,
  // but we keep this route so redirects always land in the app.
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/dashboard";
  return NextResponse.redirect(new URL(next, url.origin));
}