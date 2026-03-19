"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Mode = "login" | "signup" | "forgot";

export default function HomePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMsg("");
    setErr("");
    if (nextMode === "forgot") setPassword("");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setErr("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!sessionData.session) {
          throw new Error("Login succeeded, but no session was found.");
        }

        window.location.assign("/dashboard");
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        setMsg("Check your email to confirm your account.");
        return;
      }

      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/confirm?next=/reset&type=recovery`,
        });

        if (error) throw error;

        setMsg("Password reset email sent. Check your inbox.");
        return;
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#071024] via-black to-black text-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl">
        <div className="text-2xl font-semibold mb-2">Trading Desk</div>
        <div className="text-sm opacity-70 mb-6">
          {mode === "login" && "Login to your dashboard"}
          {mode === "signup" && "Create an account"}
          {mode === "forgot" && "Reset your password"}
        </div>

        <div className="flex gap-2 mb-6">
          <Tab active={mode === "login"} onClick={() => switchMode("login")}>
            Login
          </Tab>
          <Tab active={mode === "signup"} onClick={() => switchMode("signup")}>
            Sign up
          </Tab>
          <Tab active={mode === "forgot"} onClick={() => switchMode("forgot")}>
            Forgot
          </Tab>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs opacity-70">Email</label>
            <input
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@email.com"
              autoComplete="email"
              required
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <label className="text-xs opacity-70">Password</label>
              <input
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
              />
            </div>
          )}

          {err && <div className="text-sm text-red-400">{err}</div>}
          {msg && <div className="text-sm text-emerald-300">{msg}</div>}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-4 py-2 font-semibold"
            type="submit"
          >
            {loading
              ? "Working..."
              : mode === "login"
              ? "Login"
              : mode === "signup"
              ? "Create account"
              : "Send reset email"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-xl px-3 py-2 text-sm border",
        active
          ? "bg-white/10 border-white/20"
          : "bg-transparent border-white/10 opacity-70 hover:opacity-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
