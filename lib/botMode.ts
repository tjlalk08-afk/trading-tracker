type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asTrimmedLowerString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized =
    typeof value === "string"
      ? value.replace(/\$/g, "").replace(/,/g, "").replace(/\(/g, "-").replace(/\)/g, "").trim()
      : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  const normalized = asTrimmedLowerString(value);
  if (!normalized) return null;
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return null;
}

export function detectBotMode(upstream: unknown): "live" | "paper" {
  const root = asRecord(upstream);
  const payload = asRecord(root.data);

  const explicitModeCandidates = [
    root.mode,
    root.account_mode,
    root.trading_mode,
    root.environment,
    root.account_type,
    payload.mode,
    payload.account_mode,
    payload.trading_mode,
    payload.environment,
    payload.account_type,
    payload.account,
    payload.source,
  ];

  for (const candidate of explicitModeCandidates) {
    const normalized = asTrimmedLowerString(candidate);
    if (!normalized) continue;
    if (["paper", "test", "sim", "simulation", "demo", "sandbox", "shadow"].includes(normalized)) {
      return "paper";
    }
    if (["live", "real", "production", "prod"].includes(normalized)) {
      return "live";
    }
  }

  const explicitPaperFlags = [
    root.is_paper,
    root.paper,
    root.paper_trading,
    payload.is_paper,
    payload.paper,
    payload.paper_trading,
  ];
  for (const value of explicitPaperFlags) {
    const parsed = asBoolean(value);
    if (parsed !== null) {
      return parsed ? "paper" : "live";
    }
  }

  const directEquity = asNumber(payload.equity ?? root.equity);
  const directCash = asNumber(payload.cash ?? root.cash);
  const liveEquity = asNumber(payload.live_equity);
  const liveCash = asNumber(payload.live_cash);
  const testEquity = asNumber(payload.test_equity);
  const testCash = asNumber(payload.test_cash);

  const liveClosedTrades = Array.isArray(payload.closed_trades_live)
    ? payload.closed_trades_live.length
    : Array.isArray(payload.live_closed_trades)
      ? payload.live_closed_trades.length
      : 0;
  const testClosedTrades = Array.isArray(payload.closed_trades_test)
    ? payload.closed_trades_test.length
    : Array.isArray(payload.test_closed_trades)
      ? payload.test_closed_trades.length
      : 0;
  const balancesLookLikePaperSession =
    liveEquity !== null &&
    testEquity !== null &&
    liveEquity >= 9000 &&
    liveEquity <= 11000 &&
    testEquity >= 9000 &&
    testEquity <= 11000 &&
    Math.abs(liveEquity - testEquity) <= 250;

  if (
    (liveEquity !== null && liveEquity <= 0 && testEquity !== null && testEquity > 0) ||
    (liveCash !== null && liveCash <= 0 && testCash !== null && testCash > 0)
  ) {
    return "paper";
  }

  if (liveClosedTrades === 0 && testClosedTrades > 0) {
    return "paper";
  }

  // Some paper sessions expose both primary and test lanes with nearly identical
  // 10k-scale balances and cloned closed trades, but without an explicit mode flag.
  if (balancesLookLikePaperSession && testClosedTrades > 0) {
    return "paper";
  }

  if (directEquity === 10000 || directCash === 10000) {
    return "paper";
  }

  return "live";
}
