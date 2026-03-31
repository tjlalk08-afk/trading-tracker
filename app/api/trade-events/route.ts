import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_BASE_FIELDS = [
  "event_id",
  "event_time_utc",
  "event_type",
  "symbol",
  "mode",
  "is_test",
  "source",
] as const;

const ALLOWED_EVENT_TYPES = new Set([
  "signal_received",
  "signal_dispatched",
  "entry_decision",
  "test_pending_created",
  "test_pending_update",
  "order_submitted",
  "order_result",
  "position_opened",
  "position_snapshot",
  "position_action",
  "exit_decision",
  "trade_closed",
  "reconciliation_check",
  "risk_state",
  "optimizer_run",
]);

const ALLOWED_MODES = new Set(["live", "paper", "test"]);

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];

type JsonObject = {
  [key: string]: JsonValue;
};

type TradeEventRecord = {
  event_id: string;
  event_time_utc: string;
  event_type: string;
  symbol: string;
  underlying_symbol: string | null;
  signal_id: string | null;
  trade_id: string | null;
  parent_event_id: string | null;
  mode: "live" | "paper" | "test";
  is_test: boolean;
  strategy: string | null;
  engine: string | null;
  side: string | null;
  source: string;
  notes: string | null;
  payload: JsonObject;
  producer: string | null;
  schema_version: string | null;
};

type NormalizeEventResult =
  | { error: string }
  | { value: TradeEventRecord };

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseEventTime(value: unknown) {
  const text = asTrimmedString(value);
  if (!text) return null;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeEvent(
  raw: unknown,
  producer: string | null,
  schemaVersion: string | null,
): NormalizeEventResult {
  if (!isRecord(raw)) {
    return { error: "event must be an object" };
  }

  const eventId = asTrimmedString(raw.event_id);
  const eventType = asTrimmedString(raw.event_type);
  const symbol = asTrimmedString(raw.symbol);
  const mode = asTrimmedString(raw.mode)?.toLowerCase() ?? null;
  const source = asTrimmedString(raw.source);
  const eventTime = parseEventTime(raw.event_time_utc);
  const isTest = normalizeBoolean(raw.is_test);

  const missing = REQUIRED_BASE_FIELDS.filter((field) => {
    const value = raw[field];
    if (field === "is_test") return typeof value !== "boolean";
    return asTrimmedString(value) === null;
  });

  if (missing.length > 0) {
    return { error: `missing required fields: ${missing.join(", ")}` };
  }

  if (!eventTime) {
    return { error: "event_time_utc must be a valid ISO timestamp" };
  }

  if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
    return { error: "event_type is not supported" };
  }

  if (!mode || !ALLOWED_MODES.has(mode)) {
    return { error: "mode must be one of live, paper, test" };
  }

  if (!eventId || !symbol || !source || isTest === null) {
    return { error: "invalid required field values" };
  }

  return {
    value: {
      event_id: eventId,
      event_time_utc: eventTime,
      event_type: eventType,
      symbol,
      underlying_symbol: asTrimmedString(raw.underlying_symbol),
      signal_id: asTrimmedString(raw.signal_id),
      trade_id: asTrimmedString(raw.trade_id),
      parent_event_id: asTrimmedString(raw.parent_event_id),
      mode: mode as "live" | "paper" | "test",
      is_test: isTest,
      strategy: asTrimmedString(raw.strategy),
      engine: asTrimmedString(raw.engine),
      side: asTrimmedString(raw.side),
      source,
      notes: asTrimmedString(raw.notes),
      payload: raw,
      producer,
      schema_version: schemaVersion,
    } satisfies TradeEventRecord,
  };
}

function getEventsFromBody(body: unknown) {
  if (Array.isArray(body)) return body;
  if (isRecord(body) && Array.isArray(body.events)) return body.events;
  if (isRecord(body)) return [body];
  return null;
}

export async function POST(req: NextRequest) {
  const expected = (process.env.TRADE_EVENTS_INGEST_TOKEN ?? "").trim();
  const token = getBearerToken(req);

  if (!expected || token !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const events = getEventsFromBody(body);
  if (!events || events.length === 0) {
    return NextResponse.json(
      { ok: false, error: "request body must be an event object or events array" },
      { status: 400 },
    );
  }

  const producer = asTrimmedString(req.headers.get("x-producer"));
  const schemaVersion = asTrimmedString(req.headers.get("x-event-schema-version"));

  const acceptedRows: TradeEventRecord[] = [];
  const errors: Array<{ event_id: string | null; error: string }> = [];

  for (const rawEvent of events) {
    const normalized = normalizeEvent(rawEvent, producer, schemaVersion);
    if ("error" in normalized) {
      const eventId = isRecord(rawEvent) ? asTrimmedString(rawEvent.event_id) : null;
      errors.push({ event_id: eventId, error: normalized.error });
      continue;
    }

    acceptedRows.push(normalized.value);
  }

  if (acceptedRows.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        accepted: 0,
        duplicates: 0,
        rejected: errors.length,
        errors,
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("trade_events")
    .upsert(acceptedRows as never, {
      onConflict: "event_id",
      ignoreDuplicates: true,
    })
    .select("event_id");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const insertedIds = new Set(
    ((data as Array<{ event_id: string }> | null) ?? []).map((row) => row.event_id),
  );
  const eventIds = acceptedRows.map((row) => row.event_id);
  const duplicates = acceptedRows.length - insertedIds.size;

  return NextResponse.json({
    ok: true,
    accepted: insertedIds.size,
    duplicates,
    rejected: errors.length,
    event_ids: eventIds,
    errors,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: "/api/trade-events",
      accepts: ["single_event", "events_array"],
      auth: "Authorization: Bearer <TRADE_EVENTS_INGEST_TOKEN>",
    },
    { status: 200 },
  );
}
