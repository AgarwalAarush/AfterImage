import { z } from "zod";
import type { Paper, Source } from "./types";

export const componentIdSchema = z.string().regex(/^(explanation|diagram|quiz|figure:[a-z0-9-]{1,40})$/);
export type ComponentId = z.infer<typeof componentIdSchema>;
export const componentStateSchema = z.object({
  id: componentIdSchema,
  state: z.enum(["pending", "running", "ready", "failed", "blocked"]),
  revision: z.string().max(80).nullable(),
  dependencies: z.record(componentIdSchema, z.string().max(80)),
  sourceIds: z.array(z.string().max(160)).max(128),
}).strict();
export const kitSchema = z.object({ version: z.literal(1), revision: z.number().int().nonnegative(), components: z.array(componentStateSchema).max(6) }).strict();
export type Kit = z.infer<typeof kitSchema>;
export type KitComponent = Kit["components"][number];
export const sourceRegistrySchema = z.array(z.object({ id: z.string().min(1).max(160), label: z.string().max(500), url: z.string().url().refine(u => { const p = new URL(u); return p.protocol === "https:" && p.hostname === "arxiv.org"; }), excerpt: z.string().max(10000) }).strict()).max(128);
export function componentKind(id: string) { return id.startsWith("figure:") ? "figure" : id; }
export function componentLabel(id: string) { return id === "explanation" ? "Explanation" : id === "diagram" ? "Opening diagram" : id === "quiz" ? "Quiz" : "Study figure"; }
/** Existing reviewed content is readable without a stored-state migration. */
export function paperKit(paper: Paper): Kit {
  if (paper.kit) return paper.kit;
  const ids = [...(paper.recall ? ["explanation"] : []), ...(paper.scene || paper.visual ? ["diagram"] : []), ...(paper.study?.figures.map(f => `figure:${f.id}`) ?? []), ...(paper.study?.quiz.length ? ["quiz"] : [])];
  return { version: 1, revision: 0, components: ids.map(id => ({ id, state: "ready", revision: "legacy", dependencies: id === "explanation" ? {} as Record<string, string> : { explanation: "legacy" }, sourceIds: paper.sources.map(s => s.id).slice(0, 14) })) };
}
export function visibleComponent(kit: Kit, id: string): boolean {
  const visiting = new Set<string>();
  const visit = (key: string): boolean => {
    const c = kit.components.find(c => c.id === key);
    if (!c?.revision || visiting.has(key)) return false;
    visiting.add(key);
    const ok = Object.entries(c.dependencies).every(([dep, revision]) => kit.components.find(c => c.id === dep)?.revision === revision && visit(dep));
    visiting.delete(key); return ok;
  };
  return visit(id);
}
export function projectPublishedPaper(paper: Paper): Paper {
  if (!paper.kit) return paper;
  const kit = kitSchema.parse(paper.kit);
  const study = paper.study && { figures: paper.study.figures.filter(f => visibleComponent(kit, `figure:${f.id}`)), quiz: visibleComponent(kit, "quiz") ? paper.study.quiz : [] };
  return { ...paper, kit, visual: visibleComponent(kit, "diagram") ? paper.visual : undefined, recall: visibleComponent(kit, "explanation") ? paper.recall : null, scene: visibleComponent(kit, "diagram") ? paper.scene : null, study: study && (study.figures.length || study.quiz.length) ? study : undefined };
}
export function mergeSources(previous: Source[], incoming: Source[]): Source[] {
  const all = new Map(previous.map(s => [s.id, s]));
  for (const source of sourceRegistrySchema.parse(incoming)) {
    const old = all.get(source.id);
    if (old && (old.url !== source.url || old.excerpt !== source.excerpt)) throw new Error("Source identity changed");
    all.set(source.id, source);
  }
  return sourceRegistrySchema.parse([...all.values()]);
}
