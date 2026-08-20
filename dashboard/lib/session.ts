import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionCookie(secret: string) {
  const payload = JSON.stringify({ exp: Date.now() + MAX_AGE_MS });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = sign(encoded, secret);
  return `${encoded}.${sig}`;
}

export function verifySessionCookie(value: string | undefined, secret: string): boolean {
  if (!value) return false;
  const [encoded, sig] = value.split(".");
  if (!encoded || !sig) return false;

  const expectedSig = sign(encoded, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export { COOKIE_NAME };
