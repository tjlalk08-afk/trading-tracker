// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.SB_URL;
const key = process.env.SB_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing SB_URL or SB_SERVICE_ROLE_KEY env vars. Add them to Vercel + local .env.local."
  );
}

export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false },
});