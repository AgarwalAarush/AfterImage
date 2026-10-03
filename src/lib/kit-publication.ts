import { createHash } from "node:crypto";
import { z } from "zod";
import type { Paper, Job } from "./types";
import { resultSchema, sceneGraphSchema, prepareScene, validateScene } from "./scene";
import { studySchema, figureSchema, validateStudy } from "./study";
import { validateRecall } from "./recall-validation";
import { validateIllustrationSources } from "./scene-illustration";
import { componentIdSchema, componentStateSchema, paperKit, visibleComponent, mergeSources, sourceRegistrySchema } from "./kit";

export const digest = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const receiptSchema = z.object({
  version: z.literal(1), contentDigest: z.string().length(64), sourcesDigest: z.string().length(64),
  implementationDigest: z.string().length(64),
  gates: z.object({ source: z.literal(true), math: z.literal(true), teaching: z.literal(true), geometry: z.literal(true), visual: z.literal(true), quiz: z.literal(true) }).strict(),
}).strict();
export const componentPublicationSchema = z.object({
  completionId: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/), id: componentIdSchema,
  expectedRevision: z.string().max(80).nullable(),
  dependencies: z.record(componentIdSchema, z.string().max(80)),
  sources: sourceRegistrySchema,
  scope: z.enum(["abstract", "full-text"]), content: z.unknown(), review: receiptSchema,
}).strict();
export type ComponentPublication = z.infer<typeof componentPublicationSchema>;
export function publishKitComponent(paper: Paper, job: Job, input: unknown, leaseToken: string, now: string) {
  const publication = componentPublicationSchema.parse(input), payloadDigest = digest(publication);
  const previous = job.componentReceipts?.find(r => r.id === publication.completionId);
  if (previous) {
    if (previous.digest !== payloadDigest || previous.leaseDigest !== digest(leaseToken)) throw new Error("Conflicting completion");
    return { duplicate: true, revision: previous.revision };
  }
  if (job.status !== "running" || job.leaseToken !== leaseToken || !job.leaseUntil || Date.parse(job.leaseUntil) <= Date.parse(now)) throw new Error("Stale component lease");
  if (job.type === "component" && job.componentId !== publication.id) throw new Error("Unexpected component target");
  if (job.type === "study" && ["explanation", "diagram"].includes(publication.id)) throw new Error("Unexpected study target");
  if (!["component", "generate", "study"].includes(job.type)) throw new Error("Unexpected job type");
  const kit = structuredClone(paperKit(paper)), old = kit.components.find(c => c.id === publication.id);
  if ((old?.revision ?? null) !== publication.expectedRevision) throw new Error("Stale component revision");
  if (publication.id !== "explanation" && !publication.dependencies.explanation) throw new Error("Missing explanation dependency");
  if (publication.id === "explanation" && Object.keys(publication.dependencies).length) throw new Error("Explanation must be independently readable");
  for (const [id, revision] of Object.entries(publication.dependencies)) {
    if (id === publication.id || !visibleComponent(kit, id) || kit.components.find(c => c.id === id)?.revision !== revision) throw new Error("Stale or unavailable dependency");
  }
  if (digest(publication.content) !== publication.review.contentDigest || digest(publication.sources) !== publication.review.sourcesDigest) throw new Error("Review binding mismatch");
  const sources = mergeSources(paper.sources, publication.sources);
  let content: unknown;
  if (publication.id === "explanation") {
    content = resultSchema.shape.recall.parse(publication.content); validateRecall(content as any, publication.sources);
  } else if (publication.id === "diagram") {
    const scene = prepareScene(sceneGraphSchema.parse(publication.content)); validateScene(scene);
    if (scene.illustration) validateIllustrationSources(scene.illustration, publication.sources);
    content = scene;
  } else if (publication.id === "quiz") {
    content = studySchema.shape.quiz.parse(publication.content);
    if ((content as unknown[]).length < 2) throw new Error("Empty quiz");
    validateStudy({ figures: [], quiz: content as any }, publication.sources);
  } else {
    content = figureSchema.parse(publication.content);
    if (`figure:${(content as any).id}` !== publication.id) throw new Error("Figure identity mismatch");
    validateStudy({ figures: [content as any], quiz: [] }, publication.sources);
  }
  const revision = digest({ content, sources: publication.sources, dependencies: publication.dependencies });
  const entry = componentStateSchema.parse({ id: publication.id, state: "ready", revision, dependencies: publication.dependencies, sourceIds: publication.sources.map(s => s.id) });
  kit.components = [...kit.components.filter(c => c.id !== entry.id), entry];
  if (!visibleComponent(kit, entry.id)) throw new Error("Inconsistent publication dependencies");
  if (kit.components.length > 6) throw new Error("Too many components");
  kit.revision++;
  if ((job.componentReceipts?.length ?? 0) >= 6) throw new Error("Too many completions");
  // All validation completes before any stored state changes.
  paper.sources = sources; paper.kit = kit;
  if (publication.id === "explanation") {
    paper.recall = { ...(content as any), provenance: "codex", evidenceScope: publication.scope, generatedAt: now }; paper.generationStatus = "ready";
  } else if (publication.id === "diagram") paper.scene = content as any;
  else {
    paper.study ??= { figures: [], quiz: [] };
    if (publication.id === "quiz") paper.study.quiz = content as any;
    else paper.study.figures = [...paper.study.figures.filter(f => f.id !== (content as any).id), content as any];
  }
  job.componentReceipts ??= [];
  job.componentReceipts.push({ id: publication.completionId, digest: payloadDigest, leaseDigest: digest(leaseToken), revision, componentId: publication.id });
  return { duplicate: false, revision };
}
export function markKitComponent(paper: Paper, id: string, state: "pending" | "running" | "failed" | "blocked") {
  componentIdSchema.parse(id);
  const kit = structuredClone(paperKit(paper));
  let component = kit.components.find(c => c.id === id);
  if (!component) {
    if (kit.components.length >= 6) throw new Error("Too many components");
    component = { id, state, revision: null, dependencies: {}, sourceIds: [] }; kit.components.push(component);
  }
  component.state = state; kit.revision++; paper.kit = kit;
}
