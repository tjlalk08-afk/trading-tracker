import { headers } from "next/headers";
import BotDashboardClient from "@/components/BotDashboardClient";

export const dynamic = "force-dynamic";

async function getBotState() {
  const h = await headers();
  const host = h.get("host");

  // Vercel requests are always https. Local dev is http.
  const proto = process.env.VERCEL ? "https" : "http";
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/bot/dashboard`, { cache: "no-store" });

  if (!res.ok) {
    return { ok: false, error: "Failed to load bot state", status: res.status };
  }

  return res.json();
}

export default async function BotPage() {
  const initial = await getBotState();

  return (
    <div className="space-y-6">
      <BotDashboardClient initial={initial} />
    </div>
  );
}