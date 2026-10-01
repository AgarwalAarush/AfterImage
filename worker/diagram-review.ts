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
  "missing-visual-mechanism",
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

/** A mislabeled view must not leave a concrete diagram defect unchanged. */
export function visualRepairTarget(issues:z.infer<typeof critiqueSchema>["issues"]):"scene"|"recall"|"both"{
  const targets=issues.filter(issue=>issue.severity==="must-fix").map(issue=>{
    if(issue.view!=="recall")return "scene";
    if(/\b(recall|equation|walkthrough|evidence prose|mechanism prose|limitation)\b/i.test(issue.location))return "recall";
    if(/\b(panel|diagram|rendered|schematic|glyph|object|figure|connector|transfers?|grid)\b|GPU.*(?:SRAM|HBM)/i.test(issue.location))return "scene";
    return "recall";
  });
  return targets.length&&targets.every(target=>target==="scene")?"scene":targets.length&&targets.every(target=>target==="recall")?"recall":"both";
}
export const reviewRubric = `Use a defect rubric, not general aesthetic preferences. Inspect BOTH views at their supplied publication sizes (desktop 880px, mobile 350px). Tall figures include overlapping scroll-sized slices in addition to the overview: judge typography at the slice scale, not a shrunken overview. A slice boundary is an intentional viewport edge, not a publication clipping defect. Check every category: ${defectCategories.join(", ")}. For each defect give the exact view, object/label, observed evidence and a concrete source edit. Approval requires zero must-fix defects. Essential labels must remain readable on mobile. Verify matrix multiplication order, dimensions, arrow direction, and every equation against the supplied source. Compare scaling and normalization across ALL equations and prose: a deployment/merged-weight equation must preserve the same scaling as its forward computation unless an absorption convention is explicitly stated. Check explanatory adequacy as well as factual correctness. Judge the explicitly declared diagram focus, rather than requiring the opening to show the full paper. A memory-residency comparison may intentionally omit operands, output and online row-state arithmetic if it shows stored versus transient/absent intermediates and discloses its scope; do not reject it merely because exact softmax is explained separately in the recall or supplement. If arithmetic is depicted, require its operands, normalization and state dependencies to be correct: scope disclosure cannot excuse an incomplete shortcut to output. A diagram that only names stages while leaving the essential transferred object undefined fails ambiguous-reading-order or detached-label: identify whether each connection carries a state, token, distribution, or other object. Do not conflate training and inference or imply that a simplified chain is the complete branching method. For native token trees, prefixLabel makes the root already verified context, excluded from newly committed output. Check the rendered committed-output ribbon against the caption and recall: every claimed newly matched proposal must appear, and the target fallback must be separate from proposed nodes. A shared first speculative token must be inside the verifier frame, after a separate prefix-context root. Check recap depth: equations must cover the paper-specific mechanism where sources support it, not only background math; explanations must describe input, computation, output and purpose, not just define symbols. Worked examples must be labeled as illustrative and use consistent indices; walkthrough rows must explain what actually changes. The mechanism must describe operations, evidence must distinguish reported results from interpretation, and caveats must be specific. Do not demand unsupported detail from abstract-only sources. For missing-visual-mechanism, reject a picture that merely names a routing/selection/allocation process while leaving its defining pattern invisible. A reader must see which objects are selected, what changes from the baseline, or why a stated constraint holds. Check whether geometry carries the stated meaning: repeated object identities, occupied buckets, parameter vectors, sampled distributions, or calibrated gauge angles. Do not demand these motifs for papers where they do not apply. Reject unsupported metaphors, mislabeled distributions, wrong correction denominators, or inconsistent capacity/identity. Judge the rendered panels and all their values, selections, link directions and counts; captions alone cannot rescue an empty visual explanation. Do not reject merely for optional additions. Approve with suggestions if no actual defect remains.`;

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
  // Our panel renderer emits translations only. Preserve them while measuring outlines.
  const offset = (el: Parameters<typeof $>[0]) => $(el).parents("g").toArray().reduce((sum, parent) => {
    const match = ($(parent).attr("transform") || "").match(/^translate\(([-\d.]+)[ ,]+([-\d.]+)\)$/);
    return match ? { x: sum.x + Number(match[1]), y: sum.y + Number(match[2]) } : sum;
  }, { x: 0, y: 0 });
  $("text").each((_, el) => {
    const text = $(el).text();
    if (!text.trim()) return;
    const shift = offset(el);
    const isolated = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view[2]} ${view[3]}"><g transform="translate(${shift.x} ${shift.y})">${$.xml(el)}</g></svg>`;
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
  const nodeBounds = $("[data-node-bounds]").toArray().map(el => {
    const [x, y, width, height] = ($(el).attr("data-node-bounds") || "").split(",").map(Number);
    const shift = offset(el);
    return { id: $(el).attr("data-concept"), x: x + shift.x, y: y + shift.y, width, height };
  });
  // These are the M/H/V/C paths emitted by our own renderer, never arbitrary SVG.
  $("[data-connector]").each((_, el) => {
    const shift = offset(el);
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
            px + shift.x > b.x - 3 &&
            px + shift.x < b.x + b.width + 3 &&
            py + shift.y > b.y - 3 &&
            py + shift.y < b.y + b.height + 3
          )
            issues.push(`Connector crosses text: ${b.text}`);
        for (const b of nodeBounds)
          if (b.id !== $(el).attr("data-from") && b.id !== $(el).attr("data-to") &&
            px + shift.x > b.x && px + shift.x < b.x + b.width && py + shift.y > b.y && py + shift.y < b.y + b.height)
            issues.push(`Connector crosses node: ${b.id}`);
      }
      x = endX;
      y = endY;
    }
  });
  return [...new Set(issues)];
}


/** Overlapping scroll slices preserve publication-scale text for tall native renders. */
export function reviewSlices(width:number,height:number){
 if(height<=1700)return [];
 const regions:{left:number;top:number;width:number;height:number}[]=[];
 for(let top=0;top<height;top+=1020){
   const h=Math.min(1200,height-top);regions.push({left:0,top,width,height:h});if(top+h>=height)break;
 }
 return regions;
}
