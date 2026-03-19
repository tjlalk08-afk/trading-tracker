function resolveBotDashboardUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");

  if (trimmed.endsWith("/api/bot/dashboard")) return trimmed;
  if (trimmed.endsWith("/bot/dashboard")) {
    return `${trimmed.replace(/\/bot\/dashboard$/, "")}/api/bot/dashboard`;
  }
  if (trimmed.endsWith("/api/dashboard")) return trimmed;

  return `${trimmed}/api/bot/dashboard`;
}

export function getBotDashboardUrl() {
  const raw =
    process.env.BOT_DASHBOARD_URL?.trim() ??
    process.env.BOT_DASHBOARD_UPSTREAM?.trim() ??
    "https://dashboard.ngtdashboard.com";

  return resolveBotDashboardUrl(raw);
}
