import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ADMIN_USER_ID = "be62464a-0923-4068-ac39-dd259486685f";

export async function requireAdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || user.id !== ADMIN_USER_ID) {
    redirect("/dashboard/investors");
  }

  return user;
}