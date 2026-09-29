import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const maxClockSkewMs = 5 * 60_000;
const noncePattern = /^[0-9a-f-]{36}$/i;

function signature(secret: string, timestamp: string, nonce: string, body: string) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest("hex");
}

function envelopeSignature(secret: string, timestamp: string, nonce: string) {
  return createHmac("sha256", secret)
    .update(`envelope.${timestamp}.${nonce}`)
    .digest("hex");
}

export function signedBackendHeaders(body: string, secret: string, now = Date.now()) {
  if (secret.length < 32) throw new Error("Backend service credential is not configured.");
  const timestamp = String(now);
  const nonce = randomUUID();
  return {
    "x-afterimage-timestamp": timestamp,
    "x-afterimage-nonce": nonce,
    "x-afterimage-envelope-signature": envelopeSignature(secret, timestamp, nonce),
    "x-afterimage-signature": signature(secret, timestamp, nonce, body),
  };
}

export function validBackendEnvelope(headers: Headers, secret: string, now = Date.now()) {
  if (secret.length < 32) return false;
  const timestamp = headers.get("x-afterimage-timestamp") || "";
  const nonce = headers.get("x-afterimage-nonce") || "";
  const envelope = headers.get("x-afterimage-envelope-signature") || "";
  const supplied = headers.get("x-afterimage-signature") || "";
  return /^\d{13}$/.test(timestamp) && noncePattern.test(nonce) &&
    /^[0-9a-f]{64}$/i.test(envelope) && /^[0-9a-f]{64}$/i.test(supplied) &&
    Math.abs(now - Number(timestamp)) <= maxClockSkewMs &&
    timingSafeEqual(
      Buffer.from(envelope, "hex"),
      Buffer.from(envelopeSignature(secret, timestamp, nonce), "hex"),
    );
}

/** The bridge is one macserver process, so an in-memory replay cache is sufficient. */
export function verifyBackendRequest(
  headers: Headers,
  body: string,
  secret: string,
  seen: Map<string, number>,
  now = Date.now(),
) {
  if (!validBackendEnvelope(headers, secret, now)) return false;
  const timestamp = headers.get("x-afterimage-timestamp") || "";
  const nonce = headers.get("x-afterimage-nonce") || "";
  const supplied = headers.get("x-afterimage-signature") || "";
  const expected = Buffer.from(signature(secret, timestamp, nonce, body), "hex");
  if (!timingSafeEqual(expected, Buffer.from(supplied, "hex"))) return false;
  for (const [key, expires] of seen) if (expires <= now) seen.delete(key);
  if (seen.has(nonce) || seen.size >= 5000) return false;
  seen.set(nonce, now + maxClockSkewMs);
  return true;
}
