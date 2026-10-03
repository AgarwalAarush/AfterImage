import type { Source } from "./types";

export const sourceLimits = { active: 14, catalogue: 128, chunk: 9500 } as const;
export type CoverageSection = { id: string; label: string; kind: "section" | "appendix" | "page"; blocks: number; extractedBlocks: number; omittedBlocks: number; truncatedBlocks: number; sourceIds: string[] };
/** Private extraction diagnostics. Never attach this object to Paper or an API snapshot. */
export type ResearchBundle = {
  paperVersion?: string;
  scope: "abstract" | "full-text";
  sources: Source[];
  catalogue: Source[];
  coverage: {
    method: "html" | "pdf" | "hybrid" | "abstract";
    sections: CoverageSection[];
    omittedChunks: number;
    omittedActiveIds: string[];
    unavailable: string[];
  };
};
export function abstractResearch(sources: Source[]): ResearchBundle {
  const catalogue = sources.slice(0, 1).map(s => ({ ...s, excerpt: s.excerpt.slice(0, sourceLimits.chunk) }));
  return { scope: "abstract", sources: catalogue, catalogue, coverage: { method: "abstract", sections: [], omittedChunks: 0, omittedActiveIds: [], unavailable: ["Full-paper extraction unavailable."] } };
}
export function researchText(bundle: ResearchBundle, title: string): string {
  return JSON.stringify({ title, scope: bundle.scope, paperVersion: bundle.paperVersion, coverage: bundle.coverage, sources: bundle.sources });
}
/** Reserve a citable first chunk for each section before spending slots on continuations. */
export function activateResearch(bundle: ResearchBundle): ResearchBundle {
  const firstIds = new Set(bundle.coverage.sections.flatMap(s => s.sourceIds.slice(0, 1)));
  const first = bundle.catalogue.filter(s => s.id === "abstract" || firstIds.has(s.id));
  const chosen = new Set([...first, ...bundle.catalogue.filter(s => !first.some(f => f.id === s.id))].slice(0, sourceLimits.active).map(s => s.id));
  const sources = bundle.catalogue.filter(s => chosen.has(s.id));
  return { ...bundle, sources, coverage: { ...bundle.coverage, omittedActiveIds: bundle.catalogue.filter(s => !chosen.has(s.id)).map(s => s.id) } };
}

export function researchPaperId(id: string): string {
  if (!/^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/.test(id)) throw new Error("Invalid research paper identity");
  return id;
}
