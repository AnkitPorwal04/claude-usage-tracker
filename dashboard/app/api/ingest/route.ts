import { NextRequest, NextResponse } from "next/server";
import { saveSnapshot, Snapshot } from "@/lib/redis";
import { timingSafeStringEqual } from "@/lib/session";

export async function POST(req: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  const provided = req.headers.get("x-ingest-secret") || "";
  if (!timingSafeStringEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Snapshot;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.machine || typeof body.machine !== "string") {
    return NextResponse.json({ error: "missing machine" }, { status: 400 });
  }

  await saveSnapshot({ ...body, ts: Date.now() });
  return NextResponse.json({ ok: true });
}
