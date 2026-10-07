import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as cheerio from "cheerio";
import { inspectSvg, reviewFonts } from "./diagram-review";

type ReviewFont = { hasGlyphForCodePoint(codePoint: number): boolean };
const require = createRequire(import.meta.url);
// The repository's font-metrics generator uses this same pinned fontkit runtime.
const createFont = require("next/dist/compiled/@next/font/dist/fontkit/index.js").default as (bytes: Buffer) => ReviewFont;
let fonts: { path: string; sha256: string; font: ReviewFont }[] | undefined;
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
function reviewFontData() {
  return fonts ??= reviewFonts.fontFiles.map(path => {
    const bytes = readFileSync(path);
    return { path, sha256: digest(bytes), font: createFont(bytes) };
  });
}

/** Facts describe the supplied image scale, never the model's visual estimate. */
export function publicationTextFacts(svg: string, widthPx: number) {
  const $ = cheerio.load(svg, { xml: true });
  const view = ($("svg").attr("viewBox") || "").trim().split(/\s+/).map(Number);
  if (!Number.isFinite(widthPx) || widthPx <= 0 || view.length !== 4 || !view.every(Number.isFinite) || view[2] <= 0 || view[3] <= 0)
    throw new Error("Invalid SVG publication dimensions.");
  const scale = widthPx / view[2];
  const fontData = reviewFontData();
  const labels = $("text").toArray().flatMap(el => {
    const element = $(el), value = element.text();
    if (!value.trim()) return [];
    const size = Number(element.attr("font-size"));
    const unsupported = [...new Set([...value].filter(char => !/\s/u.test(char) && !fontData.some(({ font }) => font.hasGlyphForCodePoint(char.codePointAt(0)!))))];
    return [{ text: value, role: element.attr("data-text-role") || "unclassified", family: element.attr("font-family") || reviewFonts.defaultFontFamily,
      fontSizePx: Number.isFinite(size) && size > 0 ? Number((size * scale).toFixed(3)) : null,
      unsupportedGlyphs: unsupported.map(char => ({ char, codePoint: `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}` })) }];
  });
  return { version: "diagram-publication-v1", svgDigest: digest(svg), widthPx, heightPx: Math.round(view[3] * scale),
    viewBox: view, scale, fonts: fontData.map(({ path, sha256 }) => ({ file: path.split("/").pop()!, sha256 })),
    labels, note: "fontSizePx is the scaled base font size, not glyph ink height. Native sub/superscripts use smaller tspans. Pixel readability still requires independent image review." };
}

/** Catch partial missing-glyph strings and explicit new-layout text roles before model review. */
export function inspectPublicationSvg(svg: string, widthPx: number) {
  const facts = publicationTextFacts(svg, widthPx);
  const issues = inspectSvg(svg);
  for (const label of facts.labels) {
    if (label.unsupportedGlyphs.length) issues.push(`Unsupported diagram glyphs ${label.unsupportedGlyphs.map(glyph => `${glyph.char} (${glyph.codePoint})`).join(", ")} in ${label.text}. Use supported symbolic names with an explicit source-qualified definition; keep full typeset mathematics in the recall.`);
    const minimum = ["identity", "axis"].includes(label.role) ? 14 : label.role === "count" ? 12 : null;
    if (minimum !== null && (label.fontSizePx === null || label.fontSizePx < minimum))
      issues.push(`Small ${label.role} text at ${widthPx}px publication width: ${label.text} (${label.fontSizePx ?? "unknown"}px; minimum ${minimum}px). Typography belongs to the versioned renderer.`);
  }
  return [...new Set(issues)];
}

export const publicationReviewContract = `PUBLICATION FACTS: Each supplied render has a private manifest binding SVG bytes, font bytes, publication width and scaled base font sizes. Use those facts when stating numeric sizes; distinguish base font size from glyph ink height and smaller native sub/superscripts. Do not infer a numeric font size from a reduced overview. Readability, missing or ambiguous notation, detached labels, contrast and collisions remain independent visual judgments: passing deterministic checks never grants approval. Give specific visible evidence for a must-fix typography finding even when its measured size passes. Request semantic edits only where the bounded schema can express them; identify renderer-owned font/anchor defects as such rather than requesting arbitrary style fields. Do not waive an actual defect or invent a font failure.`;
