import { createClient } from "@supabase/supabase-js";

const url = process.env.SB_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SB_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error("Missing SB_URL or NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceRoleKey) {
  throw new Error("Missing SB_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY");
}

const adminClient = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const supabaseAdmin = adminClient;

export function getSupabaseAdmin() {
  return adminClient;
}