import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  TradeJournalDetailRow,
  TradeJournalNoteRow,
  TradeJournalScreenshotRow,
} from "@/lib/tradeJournal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCREENSHOT_BUCKET =
  process.env.TRADE_JOURNAL_SCREENSHOT_BUCKET?.trim() || "trade-journal";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const admin = getSupabaseAdmin();

    const [tradeResult, notesResult, screenshotsResult] = await Promise.all([
      admin
        .from("trade_journal_trades")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("trade_journal_notes")
        .select("id, note_type, title, body, mood, lesson, created_at")
        .eq("trade_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("trade_journal_screenshots")
        .select("id, image_url, caption, shot_type, created_at")
        .eq("trade_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (tradeResult.error) {
      return NextResponse.json(
        { ok: false, error: `Failed to load trade detail: ${tradeResult.error.message}` },
        { status: 500 },
      );
    }

    if (notesResult.error) {
      return NextResponse.json(
        { ok: false, error: `Failed to load trade notes: ${notesResult.error.message}` },
        { status: 500 },
      );
    }

    if (screenshotsResult.error) {
      return NextResponse.json(
        { ok: false, error: `Failed to load trade screenshots: ${screenshotsResult.error.message}` },
        { status: 500 },
      );
    }

    const trade = tradeResult.data as TradeJournalDetailRow | null;
    if (!trade) {
      return NextResponse.json(
        { ok: false, error: "Trade not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      trade,
      notes: (notesResult.data ?? []) as TradeJournalNoteRow[],
      screenshots: (screenshotsResult.data ?? []) as TradeJournalScreenshotRow[],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected journal detail error",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const admin = getSupabaseAdmin();
    const contentType = request.headers.get("content-type") ?? "";
    let imageUrl = "";
    let caption = "";
    let shotType = "chart";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      caption = typeof form.get("caption") === "string" ? String(form.get("caption")).trim() : "";
      shotType = typeof form.get("shot_type") === "string" ? String(form.get("shot_type")).trim() : "chart";

      if (!(file instanceof File)) {
        return NextResponse.json(
          { ok: false, error: "Screenshot file is required" },
          { status: 400 },
        );
      }

      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { ok: false, error: "Only image uploads are supported" },
          { status: 400 },
        );
      }

      const extension = file.name.includes(".")
        ? file.name.split(".").pop()?.toLowerCase() || "png"
        : "png";
      const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "png";
      const path = `${id}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
      const uploadResult = await admin.storage
        .from(SCREENSHOT_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadResult.error) {
        return NextResponse.json(
          { ok: false, error: `Failed to upload screenshot: ${uploadResult.error.message}` },
          { status: 500 },
        );
      }

      const {
        data: { publicUrl },
      } = admin.storage.from(SCREENSHOT_BUCKET).getPublicUrl(path);
      imageUrl = publicUrl;
    } else {
      const body = (await request.json()) as {
        image_url?: unknown;
        caption?: unknown;
        shot_type?: unknown;
      };

      imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : "";
      caption = typeof body.caption === "string" ? body.caption.trim() : "";
      shotType = typeof body.shot_type === "string" ? body.shot_type.trim() : "chart";
    }

    if (!imageUrl) {
      return NextResponse.json(
        { ok: false, error: "Screenshot URL is required" },
        { status: 400 },
      );
    }

    try {
      const parsed = new URL(imageUrl);
      if (!/^https?:$/.test(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "Screenshot URL must be a valid http or https URL" },
        { status: 400 },
      );
    }

    const insertResult = await admin
      .from("trade_journal_screenshots")
      .insert({
        trade_id: id,
        image_url: imageUrl,
        caption: caption || null,
        shot_type: shotType || "chart",
      } as never)
      .select("id, image_url, caption, shot_type, created_at")
      .single();

    if (insertResult.error) {
      return NextResponse.json(
        { ok: false, error: `Failed to save screenshot: ${insertResult.error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      screenshot: insertResult.data as TradeJournalScreenshotRow,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected screenshot save error",
      },
      { status: 500 },
    );
  }
}
