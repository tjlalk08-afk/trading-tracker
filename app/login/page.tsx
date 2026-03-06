"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Mode = "login" | "signup" | "forgot";

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 360,
  background: "#1b2b47",
  borderRadius: 16,
  padding: 28,
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 10,
  border: "1px solid #314766",
  padding: "0 14px",
  marginBottom: 18,
  outline: "none",
  background: "#0f1f3b",
  color: "#ffffff",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  display: "block",
  color: "#b8c4d9",
  fontSize: 14,
  marginBottom: 8,
};

const primaryBtnStyle: CSSProperties = {
  width: "100%",
  height: 44,
  border: "none",
  borderRadius: 10,
  background: "#2f66f3",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
};

const linkBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#8fb0ff",
  cursor: "pointer",
  padding: 0,
  fontSize: 14,
};

export default function LoginPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        window.location.href = "/dashboard";
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });

        if (error) throw error;

        setMsg("Account created. Check your email to verify your account, then log in.");
        return;
      }

      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset`,
        });

        if (error) throw error;

        setMsg("Password reset email sent. Check your inbox.");
        return;
      }
    } catch (err: any) {
      setMsg(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMsg("");
    setPassword("");
  }

  const isSuccessMessage =
    msg.toLowerCase().includes("sent") || msg.toLowerCase().includes("created");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#071633",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={cardStyle}>
        <h1
          style={{
            color: "#ffffff",
            fontSize: 18,
            fontWeight: 600,
            margin: "0 0 24px 0",
          }}
        >
          {mode === "login"
            ? "Login"
            : mode === "signup"
            ? "Create account"
            : "Forgot password"}
        </h1>

        <form onSubmit={onSubmit}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />

          {mode !== "forgot" && (
            <>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                style={inputStyle}
              />
            </>
          )}

          {msg && (
            <div
              style={{
                color: isSuccessMessage ? "#b8c4d9" : "#ff8b8b",
                fontSize: 14,
                lineHeight: 1.4,
                marginBottom: 14,
              }}
            >
              {msg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...primaryBtnStyle,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : mode === "signup"
              ? "Create account"
              : "Send reset link"}
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {mode === "login" ? (
            <>
              <button type="button" onClick={() => switchMode("signup")} style={linkBtn}>
                Sign up
              </button>

              <button type="button" onClick={() => switchMode("forgot")} style={linkBtn}>
                Forgot password?
              </button>
            </>
          ) : (
            <button type="button" onClick={() => switchMode("login")} style={linkBtn}>
              Back to login
            </button>
          )}
        </div>
      </div>
    </main>
  );
}