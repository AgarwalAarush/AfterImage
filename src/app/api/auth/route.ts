import { NextResponse } from "next/server";
import { safeEqual, signSession, sameOrigin } from "@/lib/auth";
const attempts = new Map<string, { n: number; until: number }>();
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const ip = req.headers.get("x-forwarded-for") || "local",
    record = attempts.get(ip);
  if (record && record.until > Date.now() && record.n >= 8)
    return NextResponse.json(
      { error: "Please wait a few minutes before trying again." },
      { status: 429 },
    );
  const { key } = await req.json();
  const expected = process.env.AFTERIMAGE_ACCESS_KEY;
  if (!expected || typeof key !== "string" || !safeEqual(key, expected)) {
    attempts.set(ip, {
      n: (record?.until || 0) > Date.now() ? record!.n + 1 : 1,
      until: Date.now() + 600000,
    });
    return NextResponse.json(
      { error: "That access key is not correct." },
      { status: 401 },
    );
  }
  attempts.delete(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("afterimage_session", signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86400,
  });
  return response;
}
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("afterimage_session");
  return response;
}
