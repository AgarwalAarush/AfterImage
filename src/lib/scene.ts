import { z } from "zod";
export const sceneSchema = z.object({
  title: z.string().min(1).max(70),
  description: z.string().min(1).max(400),
  footnote: z.string().max(100),
  nodes: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .max(30),
        kind: z.enum(["box", "circle", "matrix", "stack", "experts"]),
        x: z.number().min(20).max(680),
        y: z.number().min(60).max(310),
        w: z.number().min(40).max(240),
        h: z.number().min(35).max(200),
        label: z.string().min(1).max(26),
        detail: z.string().max(32),
        emphasis: z.boolean(),
      }),
    )
    .min(2)
    .max(8),
  edges: z
    .array(
      z.object({
        from: z.string().max(30),
        to: z.string().max(30),
        label: z.string().max(24),
        dashed: z.boolean(),
      }),
    )
    .max(10),
});
export const resultSchema = z.object({
  recall: z.object({
    version: z.literal(2),
    idea: z.string().min(1).max(200),
    problem: z.string().min(1).max(1800),
    mechanism: z.string().min(1).max(3000),
    evidence: z.string().min(1).max(2200),
    limitation: z.string().min(1).max(1800),
    significance: z.string().min(1).max(1400),
    equations: z
      .array(
        z.object({
          title: z.string().max(100).nullish(),
          latex: z.string().min(1).max(1200),
          explanation: z.string().min(1).max(2400),
          example: z.string().max(1400).nullish(),
          sourceId: z.string(),
        }),
      )
      .max(5),
    walkthrough: z.object({
      title: z.string().max(100),
      introduction: z.string().max(1200),
      steps: z.array(z.object({
        label: z.string().max(80), input: z.string().max(500),
        operation: z.string().max(700), output: z.string().max(500),
      })).min(2).max(6),
      sourceId: z.string(),
    }).nullish(),
    sourceIds: z.array(z.string()).min(1).max(8),
  }),
  scene: sceneSchema,
});
export const recommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        paperId: z.string(),
        role: z.string().max(40),
        reason: z.string().max(400),
        focus: z.string().max(200),
        depth: z.string().max(50),
      }),
    )
    .max(3),
});
export const escapeXml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
/** Native SVG scripts avoid missing Unicode subscript glyphs in UI fonts. */
export function diagramText(value: string) {
  const subs: Record<string, string> = {
    "₀": "0",
    "₁": "1",
    "₂": "2",
    "₃": "3",
    "₄": "4",
    "₅": "5",
    "₆": "6",
    "₇": "7",
    "₈": "8",
    "₉": "9",
    ₐ: "a",
    ₑ: "e",
    ₕ: "h",
    ᵢ: "i",
    ⱼ: "j",
    ₖ: "k",
    ₗ: "l",
    ₘ: "m",
    ₙ: "n",
    ₒ: "o",
    ₚ: "p",
    ᵣ: "r",
    ₛ: "s",
    ₜ: "t",
    ᵤ: "u",
    ᵥ: "v",
    ₓ: "x",
  };
  return escapeXml(value)
    .replace(
      /[₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]+/g,
      (s) =>
        `<tspan baseline-shift="sub" font-size="70%">${[...s].map((c) => subs[c]).join("")}</tspan>`,
    )
    .replace(
      /_([0-9a-z])\b/g,
      '<tspan baseline-shift="sub" font-size="70%">$1</tspan>',
    )
    .replace(
      /\^([T0-9])/g,
      '<tspan baseline-shift="super" font-size="70%">$1</tspan>',
    );
}
export function validateScene(input: unknown) {
  const scene = sceneSchema.parse(input),
    ids = new Set(scene.nodes.map((n) => n.id));
  if (ids.size !== scene.nodes.length)
    throw new Error("Duplicate diagram identifiers.");
  const labels = [scene.title, scene.footnote, ...scene.nodes.flatMap(n => [n.label, n.detail]), ...scene.edges.map(e => e.label)];
  if (labels.some(label => /\$[^$]+\$|\\[a-zA-Z]+/.test(label)))
    throw new Error("Diagram labels must use readable plain text or native Unicode notation, not raw LaTeX. Keep rendered LaTeX in the recall equations.");
  for (const n of scene.nodes) {
    if (n.x + n.w > 760 || n.y + n.h > 405)
      throw new Error("Diagram extends beyond its frame.");
  }
  for (let i = 0; i < scene.nodes.length; i++)
    for (let j = i + 1; j < scene.nodes.length; j++) {
      const a = scene.nodes[i],
        b = scene.nodes[j];
      if (
        a.x < b.x + b.w + 10 &&
        a.x + a.w + 10 > b.x &&
        a.y < b.y + b.h + 24 &&
        a.y + a.h + 24 > b.y
      )
        throw new Error("Diagram objects or labels overlap.");
    }
  for (const e of scene.edges) {
    if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to)
      throw new Error("Diagram has an invalid connection.");
  }
  return scene;
}
export function sceneSvg(input: unknown, accent = "#7761bb") {
  const s = validateScene(input);
  const txt = (
    x: number,
    y: number,
    t: string,
    size = 14,
    color = "#34332f",
    family = "IBM Plex Mono",
  ) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="${family}, monospace" font-size="${size}" fill="${color}">${diagramText(t)}</text>`;
  let edges = "";
  for (const e of s.edges) {
    const a = s.nodes.find((n) => n.id === e.from)!,
      b = s.nodes.find((n) => n.id === e.to)!;
    const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
    const outgoing = s.edges.filter((edge) => edge.from === a.id),
      incoming = s.edges.filter((edge) => edge.to === b.id);
    const fromFraction = (outgoing.indexOf(e) + 1) / (outgoing.length + 1),
      toFraction = (incoming.indexOf(e) + 1) / (incoming.length + 1);
    const port = (n: typeof a, fraction: number, side: number) => {
      const y = n.y + n.h * fraction;
      const inset =
        n.kind === "circle"
          ? (n.w / 2) * (1 - Math.sqrt(1 - (2 * fraction - 1) ** 2))
          : 0;
      return { x: side > 0 ? n.x + n.w - inset : n.x + inset, y };
    };
    const forward = horizontal ? b.x > a.x : b.y > a.y;
    const { x: x1, y: y1 } = port(
        a,
        fromFraction,
        horizontal ? (forward ? 1 : -1) : 1,
      ),
      { x: x2, y: y2 } = port(
        b,
        toFraction,
        horizontal ? (forward ? -1 : 1) : 1,
      );
    const curve = horizontal
      ? `C${(x1 + x2) / 2} ${y1},${(x1 + x2) / 2} ${y2},${x2} ${y2}`
      : `C${Math.max(x1, x2) + 35} ${y1},${Math.max(x1, x2) + 35} ${y2},${x2} ${y2}`;
    edges += `<path data-connector="true" d="M${x1} ${y1} ${curve}" fill="none" stroke="${accent}" stroke-opacity=".75" stroke-width="1.7" marker-end="url(#arrow)" ${e.dashed ? 'stroke-dasharray="5 6"' : ""}/>${e.label ? txt((x1 + x2) / 2 + (horizontal ? 0 : 35), (y1 + y2) / 2 - (horizontal ? 14 : 0), e.label, 12) : ""}`;
  }
  let nodes = "";
  for (const n of s.nodes) {
    const fill = n.emphasis ? accent + "18" : "#fafaf9",
      stroke = n.emphasis ? accent : "#d6d4da";
    let shape = "";
    if (n.kind === "experts") {
      for (let i = 0; i < 8; i++) {
        const col = i % 4,
          row = Math.floor(i / 4),
          cw = (n.w - 21) / 4,
          ch = (n.h - 12) / 2,
          on = i === 0 || i === 5;
        shape += `<rect x="${n.x + col * (cw + 7)}" y="${n.y + row * (ch + 12)}" width="${cw}" height="${ch}" rx="3" fill="${on ? accent + "30" : "#f8f8f8"}" stroke="${on ? accent : "#dcdae1"}"/>`;
      }
    } else if (n.kind === "circle")
      shape = `<ellipse cx="${n.x + n.w / 2}" cy="${n.y + n.h / 2}" rx="${n.w / 2}" ry="${n.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
    else {
      if (n.kind === "stack")
        shape = `<path d="M${n.x} ${n.y} l16 -14 h${n.w} l-16 14 M${n.x + n.w} ${n.y} l16 -14 v${n.h} l-16 14" fill="${accent}10" stroke="${stroke}"/>`;
      shape += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.kind === "matrix" ? 0 : 8}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
      if (n.kind === "matrix") {
        for (let i = 1; i < 5; i++)
          shape += `<path d="M${n.x + (n.w * i) / 5} ${n.y} v${n.h} M${n.x} ${n.y + (n.h * i) / 5} h${n.w}" stroke="${stroke}" stroke-opacity=".5"/>`;
      }
    }
    const lines = (value: string, max: number) => {
      const out: string[] = [];
      for (const word of value.split(" ")) {
        if (!out.length || out[out.length - 1].length + word.length + 1 > max)
          out.push(word);
        else out[out.length - 1] += " " + word;
      }
      return out;
    };
    // IBM Plex Mono advances 0.6em; reserve padding inside each shape.
    const titleLines = lines(n.label, Math.max(7, Math.floor((n.w - 24) / 8.4))),
      detailLines = lines(n.detail, Math.max(9, Math.floor((n.w + 16) / 6)));
    nodes += `<g data-concept="${n.id}">${shape}${n.kind === "matrix" ? `<rect x="${n.x + 4}" y="${n.y + n.h / 2 - titleLines.length * 8 - 4}" width="${n.w - 8}" height="${titleLines.length * 16 + 8}" fill="${n.emphasis ? "#f1edf6" : "#fafaf9"}"/>` : ""}${titleLines.map((t, i) => txt(n.x + n.w / 2, (n.kind === "experts" ? n.y - 12 : n.y + n.h / 2 + 4) + (i - (titleLines.length - 1) / 2) * 16, t, 14)).join("")}${detailLines.map((t, i) => txt(n.x + n.w / 2, n.y + n.h + 19 + i * 14, t, 12, "#62675f")).join("")}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 470" role="img" aria-label="${escapeXml(s.description)}"><title>${escapeXml(s.title)}</title><desc>${escapeXml(s.description)}</desc><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="none" stroke="${accent}" stroke-width="1"/></marker></defs>${txt(400, 27, s.title.toUpperCase(), 13, "#62675f", "Departure Mono")}${edges}${nodes}${txt(400, 454, s.footnote, 12, "#62675f", "IBM Plex Mono")}</svg>`;
}

/** A separate portrait composition preserves the graph's actual connections. */
export function sceneSvgMobile(input: unknown, accent = "#7761bb") {
  const s = validateScene(input);
  const ordered: typeof s.nodes = [];
  const remaining = [...s.nodes];
  while (remaining.length) {
    const i = remaining.findIndex((n) =>
      s.edges
        .filter((e) => e.to === n.id)
        .every((e) => ordered.some((o) => o.id === e.from)),
    );
    ordered.push(remaining.splice(i < 0 ? 0 : i, 1)[0]);
  }
  const height = 185 + ordered.length * 155;
  const wrap = (text: string, limit: number) => {
    const lines: string[] = [];
    for (const word of text.split(" ")) {
      if (
        !lines.length ||
        lines[lines.length - 1].length + word.length + 1 > limit
      )
        lines.push(word);
      else lines[lines.length - 1] += " " + word;
    }
    return lines;
  };
  const text = (
    x: number,
    y: number,
    value: string,
    size = 16,
    family = "IBM Plex Mono",
    anchor = "middle",
  ) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${family}, monospace" font-size="${size}" fill="#535b52">${diagramText(value)}</text>`;
  let nodes = "",
    edges = "";
  for (const [i, n] of ordered.entries()) {
    const y = 105 + i * 155;
    const fill = n.emphasis ? accent + "18" : "#fbfbfa";
    const stroke = n.emphasis ? accent : "#d7d3de";
    if (n.kind === "experts") {
      for (let k = 0; k < 8; k++)
        nodes += `<rect x="${78 + (k % 4) * 57}" y="${y + Math.floor(k / 4) * 40}" width="48" height="32" rx="3" fill="${k === 0 || k === 5 ? accent + "30" : "#f8f8f8"}" stroke="${k === 0 || k === 5 ? accent : "#ddd9e3"}"/>`;
      nodes += text(190, y - 10, n.label);
    } else {
      if (n.kind === "circle")
        nodes += `<ellipse cx="190" cy="${y + 37}" rx="90" ry="37" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
      else
        nodes += `<rect x="75" y="${y}" width="230" height="74" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
      const labelLines = wrap(n.label, 21);
      nodes += labelLines.map((label, line) =>
        text(190, y + 42 + (line - (labelLines.length - 1) / 2) * 20, label),
      ).join("");
    }
    nodes += text(190, y + 94, n.detail, 14);
  }
  for (const e of s.edges) {
    const a = ordered.findIndex((n) => n.id === e.from),
      b = ordered.findIndex((n) => n.id === e.to);
    const y1 = 105 + a * 155 + 103,
      y2 = 105 + b * 155 - (ordered[b].kind === "experts" ? 36 : 19);
    const d =
      b === a + 1
        ? `M190 ${y1} V${y2}`
        : `M75 ${105 + a * 155 + 37} H35 V${105 + b * 155 + 37} H70`;
    edges += `<path data-connector="true" d="${d}" fill="none" stroke="${accent}" stroke-width="1.3" marker-end="url(#arrow-mobile)" ${e.dashed ? 'stroke-dasharray="4 5"' : ""}/>`;
    if (e.label && b === a + 1)
      edges += text(
        210,
        (y1 + y2) / 2 + 4,
        e.label,
        14,
        "IBM Plex Mono",
        "start",
      );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 ${height}" role="img" aria-label="${escapeXml(s.description)}"><title>${escapeXml(s.title)}</title><desc>${escapeXml(s.description)}</desc><defs><marker id="arrow-mobile" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="${accent}"/></marker></defs>${wrap(
    s.title,
    30,
  )
    .map((t, i) => text(190, 22 + i * 19, t, 15, "Departure Mono"))
    .join("")}${edges}${nodes}${wrap(s.footnote, 39)
    .map((t, i) => text(190, height - 62 + i * 17, t, 13, "IBM Plex Mono"))
    .join("")}</svg>`;
}
