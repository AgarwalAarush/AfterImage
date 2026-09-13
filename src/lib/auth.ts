import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function signSession() {
  const expires = String(Date.now() + 30 * 86400000);
  return `${expires}.${createHmac("sha256", process.env.AFTERIMAGE_ACCESS_KEY!).update(expires).digest("hex")}`;
}
export async function authenticated() {
  if (process.env.NODE_ENV === "development" && !process.env.VERCEL)
    return true;
  const key = process.env.AFTERIMAGE_ACCESS_KEY;
  if (!key) return false;
  const value = (await cookies()).get("afterimage_session")?.value;
  if (!value) return false;
  const [expiry, hash] = value.split(".");
  if (!hash || Number(expiry) < Date.now()) return false;
  return safeEqual(
    hash,
    createHmac("sha256", key).update(expiry).digest("hex"),
  );
}
export function workerAuth(r: Request) {
  const key = process.env.AFTERIMAGE_WORKER_TOKEN;
  return Boolean(
    key && safeEqual(r.headers.get("authorization") || "", `Bearer ${key}`),
  );
}
export function sameOrigin(r: Request) {
  const origin = r.headers.get("origin");
  if (!origin) return true;
  try {
    return (
      new URL(origin).host === (r.headers.get("host") || new URL(r.url).host)
    );
  } catch {
    return false;
  }
}
