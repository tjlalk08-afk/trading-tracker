"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function ResetPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;

      setMsg("Password updated. Redirecting…");
      setTimeout(() => router.push("/dashboard"), 600);
    } catch (err: any) {
      setMsg(err?.message ?? "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060b14] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-xl">
        <div className="text-xl font-semibold">Set a new password</div>
        <div className="text-sm opacity-70 mb-5">
          This page is opened from the email reset link.
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <div className="text-xs opacity-70 mb-1">New password</div>
            <input
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              type="password"
              required
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none focus:border-white/30"
            />
          </label>

          {msg && (
            <div className="text-sm rounded-xl border border-white/10 bg-black/20 p-3">
              {msg}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-3 py-2 font-semibold"
            type="submit"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}