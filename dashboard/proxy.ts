import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionCookie } from "@/lib/session";

export function proxy(req: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const valid = !!secret && verifySessionCookie(cookie, secret);

  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
