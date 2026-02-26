"use client";

import { useEffect, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export default function LoginPage() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
    setSupabase(client);
  }, []);

  async function signUp() {
    if (!supabase) return;
    setMsg("");
    const { error } = await supabase.auth.signUp({ email, password });
    setMsg(error ? error.message : "Signed up. Now log in.");
  }

  async function signIn() {
    if (!supabase) return;
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setMsg(error ? error.message : "Logged in! Go to /dashboard");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setMsg("Signed out.");
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", fontFamily: "Arial" }}>
      <h1>Trading Tracker Login</h1>

      <input
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
        onClick={signIn}
      >
        Log in
      </button>

      <button
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
        onClick={signUp}
      >
        Sign up
      </button>

      <button style={{ width: "100%", padding: 10 }} onClick={signOut}>
        Log out
      </button>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}