import { NextRequest, NextResponse } from "next/server";
import { getAllSnapshots } from "@/lib/redis";
import { COOKIE_NAME, verifySessionCookie } from "@/lib/session";

export async function GET(req: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  const cookie = req.cookies.get(COOKIE_NAME)?.value;

  const headers = { "Cache-Control": "no-store" };

  if (!secret || !verifySessionCookie(cookie, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }

  const snapshots = await getAllSnapshots();
  return NextResponse.json({ snapshots }, { headers });
}
