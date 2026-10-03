import { createHash } from "node:crypto";
import { z } from "zod";
import { fingerprint, RepairFailure, valueAt } from "./repair-controller";

export type CandidateSpan = { id: string; candidate: string; path: string; field: string; startByte: number; endByte: number; digest: string; text: string };
const bytesDigest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const metadata = new Set(["id", "sourceId", "sourceIds", "provenance", "evidenceScope", "generatedAt", "createdAt", "updatedAt", "revision", "version"]);
export function candidateSpan(candidate: unknown, path: string, start: number, end: number): CandidateSpan {
  const field = valueAt(candidate, path);
  if (typeof field !== "string" || start < 0 || end > field.length || end <= start) throw new RepairFailure("schema", "Invalid exact candidate span.");
  const text = field.slice(start, end), descriptor = { candidate: fingerprint(candidate), path, field: bytesDigest(field), startByte: Buffer.byteLength(field.slice(0, start)), endByte: Buffer.byteLength(field.slice(0, end)), digest: bytesDigest(text) };
  return { id: fingerprint(descriptor), ...descriptor, text };
}
/** Exact visible text only. Metadata cannot become a scientific passage. No normalization. */
export function candidateTextSpans(candidate: unknown): CandidateSpan[] {
  const spans: CandidateSpan[] = [];
  function visit(value: unknown, path: string) {
    if (typeof value === "string") {
      if (value.length > 32000) throw new RepairFailure("schema", "Candidate text field exceeds exact-span bound.");
      // Sentences/lines are selection units, not inferred scientific claims.
      const cuts = [...value.matchAll(/[.!?](?=\s|$)|\n/g)].map(m => m.index! + m[0].length);
      let start = 0;
      for (const end of [...cuts, value.length]) {
        if (end <= start) continue;
        while (end - start > 1800) { let cut = start + 1800; if (/^[\uDC00-\uDFFF]$/.test(value[cut])) cut--; spans.push(candidateSpan(candidate, path, start, cut)); start = cut; }
        if (value.slice(start, end).trim()) spans.push(candidateSpan(candidate, path, start, end)); start = end;
      }
    } else if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${path}/${i}`));
    else if (value && typeof value === "object") for (const [key, v] of Object.entries(value)) if (!metadata.has(key)) visit(v, `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
  }
  visit(candidate, "");
  if (spans.length > 512) throw new RepairFailure("schema", "Candidate exact-span catalogue exceeds its bound.");
  return spans;
}
export function candidateSpanSelection(candidate: unknown, spans = candidateTextSpans(candidate)) {
  const ids = spans.length ? z.array(z.enum(spans.map(s => s.id) as [string, ...string[]])).min(1).max(8) : z.array(z.never()).max(0);
  const resolve = (selected: string[]) => {
    if (!selected.length || selected.length > 8 || new Set(selected).size !== selected.length) throw new RepairFailure("schema", "Invalid candidate span selection.");
    return selected.map(id => {
      const span = spans.find(s => s.id === id), field = span && valueAt(candidate, span.path);
      if (!span || span.candidate !== fingerprint(candidate) || typeof field !== "string" || span.field !== bytesDigest(field) || bytesDigest(Buffer.from(field).subarray(span.startByte, span.endByte).toString("utf8")) !== span.digest || Buffer.from(field).subarray(span.startByte, span.endByte).toString("utf8") !== span.text) throw new RepairFailure("schema", "Stale or altered exact candidate span.");
      return span;
    });
  };
  return { spans, ids, resolve };
}
/** Historical diagnostic only: strip one received quote wrapper, then locate exact bytes. */
export function locateHistoricalCandidateQuote(candidate: unknown, quote: string): CandidateSpan | undefined {
  const pairs: [string, string][] = [["“", "”"], ["‘", "’"], ['"', '"']];
  const pair = pairs.find(([a, b]) => quote.startsWith(a) && quote.endsWith(b));
  const text = pair ? quote.slice(pair[0].length, -pair[1].length) : quote;
  if (!text) return;
  for (const span of candidateTextSpans(candidate)) {
    const field = valueAt(candidate, span.path) as string, offset = field.indexOf(text);
    if (offset >= 0) return candidateSpan(candidate, span.path, offset, offset + text.length);
  }
}
