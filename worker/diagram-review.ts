import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import * as cheerio from "cheerio";
import { z } from "zod";

export const reviewFonts = {
  loadSystemFonts: false,
  fontFiles: [
    "DepartureMono-Regular.otf",
    "IBMPlexMono-Regular.ttf",
  ].map((f) => path.resolve("worker/fonts", f)),
  defaultFontFamily: "IBM Plex Mono",
  sansSerifFamily: "IBM Plex Mono",
  monospaceFamily: "IBM Plex Mono",
};
export const defectCategories = [
  "small-text",
  "text-shape-collision",
  "text-connector-collision",
  "uneven-balance",
  "clipped-strokes",
  "obscured-arrowhead",
  "inconsistent-strokes",
  "ambiguous-reading-order",
  "spacing",
  "weak-contrast",
  "detached-label",
  "incorrect-notation",
  "misleading-emphasis",
  "unsupported-claim",
] as const;
export const critiqueSchema = z.object({
  approved: z.boolean(),
  issues: z
    .array(
      z.object({
        category: z.enum(defectCategories),
        view: z.enum(["desktop", "mobile", "recall"]),
        location: z.string(),
        severity: z.enum(["must-fix", "suggestion"]),
        evidence: z.string(),
        repair: z.string(),
      }),
    )
    .max(16),
});
export const reviewRubric = `Use a defect rubric, not general aesthetic preferences. Inspect BOTH images at their supplied publication sizes (desktop 880px, mobile 350px). Check every category: ${defectCategories.join(", ")}. For each defect give the exact view, object/label, observed evidence and a concrete source edit. Approval requires zero must-fix defects. Essential labels must remain readable on mobile. Verify matrix multiplication order, dimensions, arrow direction, and every equation against the supplied source. Compare scaling and normalization across ALL equations and prose: a deployment/merged-weight equation must preserve the same scaling as its forward computation unless an absorption convention is explicitly stated. Check explanatory adequacy as well as factual correctness. A diagram that only names stages while leaving the essential transferred object undefined fails ambiguous-reading-order or detached-label: identify whether each connection carries a state, token, distribution, or other object. Do not conflate training and inference or imply that a simplified chain is the complete branching method. Check recap depth: equations must cover the paper-specific mechanism where sources support it, not only background math; explanations must describe input, computation, output and purpose, not just define symbols. Worked examples must be labeled as illustrative and use consistent indices; walkthrough rows must explain what actually changes. The mechanism must describe operations, evidence must distinguish reported results from interpretation, and caveats must be specific. Do not demand unsupported detail from abstract-only sources. Do not reject merely for optional additions. Approve with suggestions if no actual defect remains.`;

/** Measure actual font outlines, rather than estimating width from character count. */
export function inspectSvg(svg: string): string[] {
  const $ = cheerio.load(svg, { xml: true }),
    root = $("svg"),
    view = (root.attr("viewBox") || "").split(/\s+/).map(Number);
  const issues: string[] = [],
    labels: {
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];
  $("text").each((_, el) => {
    const text = $(el).text();
    if (!text.trim()) return;
    const isolated = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view[2]} ${view[3]}">${$.xml(el)}</svg>`;
    const box = new Resvg(isolated, { font: reviewFonts }).getBBox();
    if (!box || box.width === 0) {
      issues.push(`Missing glyphs for ${text}`);
      return;
    }
    labels.push({
      text,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    if (
      box.x < 3 ||
      box.y < 3 ||
      box.x + box.width > view[2] - 3 ||
      box.y + box.height > view[3] - 3
    )
      issues.push(`Clipped text: ${text}`);
  });
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i],
        b = labels[j];
      if (
        a.x < b.x + b.width + 2 &&
        a.x + a.width + 2 > b.x &&
        a.y < b.y + b.height + 2 &&
        a.y + a.height + 2 > b.y
      )
        issues.push(`Text collision: ${a.text} / ${b.text}`);
    }
  // These are the M/H/V/C paths emitted by our own renderer, never arbitrary SVG.
  $("[data-connector]").each((_, el) => {
    const commands = ($(el).attr("d") || "").match(/[MHVLC][^MHVLC]*/g) || [];
    let x = 0,
      y = 0;
    for (const command of commands) {
      const type = command[0],
        n = command
          .slice(1)
          .trim()
          .split(/[\s,]+/)
          .map(Number);
      if (type === "M") {
        [x, y] = n;
        continue;
      }
      const startX = x,
        startY = y,
        endX = type === "V" ? x : type === "C" ? n[4] : n[0],
        endY =
          type === "H" ? y : type === "V" ? n[0] : type === "C" ? n[5] : n[1];
      for (let i = 1; i < 60; i++) {
        const t = i / 60,
          u = 1 - t,
          px =
            type === "C"
              ? u * u * u * startX +
                3 * u * u * t * n[0] +
                3 * u * t * t * n[2] +
                t * t * t * endX
              : startX + (endX - startX) * t,
          py =
            type === "C"
              ? u * u * u * startY +
                3 * u * u * t * n[1] +
                3 * u * t * t * n[3] +
                t * t * t * endY
              : startY + (endY - startY) * t;
        for (const b of labels)
          if (
            px > b.x - 3 &&
            px < b.x + b.width + 3 &&
            py > b.y - 3 &&
            py < b.y + b.height + 3
          )
            issues.push(`Connector crosses text: ${b.text}`);
      }
      x = endX;
      y = endY;
    }
  });
  return [...new Set(issues)];
}
