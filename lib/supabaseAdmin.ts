import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SB_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY;

console.log("SUPABASE ADMIN ENV CHECK", {
  hasNextPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasSbUrl: !!process.env.SB_URL,
  hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasSbServiceRole: !!process.env.SB_SERVICE_ROLE_KEY,
});

if (!url) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SB_URL");
}

if (!serviceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SB_SERVICE_ROLE_KEY");
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});