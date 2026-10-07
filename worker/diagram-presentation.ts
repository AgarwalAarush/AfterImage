import { prepareScene } from "../src/lib/scene";
import type { Illustration } from "../src/lib/scene-illustration";

export function prepareDraftIllustration(illustration: Illustration): Illustration {
  return { ...illustration, panels: illustration.panels.map(panel =>
    panel.kind === "routing" && panel.presentation !== "buckets"
      ? { ...panel, layout: "readable-routing-v1" as const } : panel) };
}

/** Version only fresh draft assignments. Stored, reviewed scenes are never rewritten. */
export function prepareDraftScene(input: unknown) {
  const scene = prepareScene(input);
  if (!scene.illustration) return scene;
  return { ...scene, illustration: prepareDraftIllustration(scene.illustration) };
}

export const diagramPresentationContract = `NATIVE PRESENTATION CONTRACT: The renderer owns font size, geometry, and glyph support; the model cannot change them. New routing assignments use readable-routing-v1 with readable identities and axes. Routing presentation:links permits complete labels up to 18 characters on BOTH sides; only presentation:buckets restricts LEFT token identities to four characters. Do not shorten valid links labels merely to apply the bucket bound. Keep identities unique and preserve every assignment and its direction. Plain SVG text is not a math typesetter: never promise set-region geometry, LaTeX typesetting, arbitrary fonts, or unsupported symbols. Use short source-qualified symbolic names when needed, define them clearly in the caption/recall, and keep the full equations in the KaTeX recall. A glyph named as an array must identify that array; its scalar norm is a different quantity, which must be labeled as a scalar. A transferred intermediate cannot change domain or identity at an edge: show the essential source-supported conversion and its inputs for the chosen focus. Prefer a complete narrower mechanism when the full iteration exceeds native bounds, while retaining the full paper explanation in recall. Prefer complete short phrases with headroom: node details under 44 characters (hard limit 52), captions under 140 (hard limit 160). Rewrite rather than cut a word, clause or definition at the bound. A label saying that two constraints hold does not prove a shared target unless the objects and relationships visibly encode it. If a visual finding needs font-size or anchor changes that the semantic schema cannot express, choose another existing native representation only when it preserves the complete declared visible proof; do not invent an operation, change meaning, or drop a required relationship to fit. A supported font-size fact does not itself establish readability, and all source, geometry, technical and visual gates still apply.`;
