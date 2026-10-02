import { z } from "zod";

export const subjectTopics = ["Diffusion", "Architecture", "Training", "LLMs", "Vision", "RL & alignment", "Multimodal", "Theory"] as const;
export const subjectEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1),
  topic: z.enum(subjectTopics), referenceUrl: z.string().url(),
  arxivId: z.string().regex(/^\d{4}\.\d{4,5}$/), primaryUrl: z.string().url(),
});
export type SubjectEntry = z.infer<typeof subjectEntrySchema>;
export const experimentKinds = ["noise", "attention", "low-rank", "normalization", "optimizer", "policy", "quantization", "memory", "routing", "patches", "state", "contrastive", "graph", "search", "latent", "ode", "scaling", "guidance", "retrieval", "spatial", "streaming-attention", "noise-shells", "volume-rendering", "paired-scaling", "rolling-window"] as const;
const sourceIds = z.array(z.string().min(1)).min(1).max(8);
export const subjectFigureSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), kind: z.enum(experimentKinds),
  title: z.string().min(5).max(100), question: z.string().min(20).max(300),
  caption: z.string().min(40).max(1000), limitation: z.string().min(20).max(500),
  sourceIds, claimIds: z.array(z.string()).min(1).max(6),
  illustrative: z.literal(true),
});
export type SubjectFigure = z.infer<typeof subjectFigureSchema>;
export const subjectLessonSchema = z.object({
  title: z.string().min(5).max(140), summary: z.string().min(40).max(350),
  prerequisites: z.array(z.string().min(3).max(100)).min(1).max(6),
  objectives: z.array(z.string().min(10).max(160)).min(3).max(5),
  claims: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    kind: z.enum(["mechanism", "equation", "result", "caveat"]),
    statement: z.string().min(20).max(900), conditions: z.string().max(700),
    sourceIds, evidence: z.string().min(20).max(350),
  })).min(8).max(18),
  sections: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(5).max(100),
    markdown: z.string().min(400).max(10000), sourceIds,
    claimIds: z.array(z.string()).min(1).max(8),
    figureId: z.string().nullable(),
  })).min(6).max(9),
  figures: z.array(subjectFigureSchema).min(1).max(3),
  quiz: z.array(z.object({
    question: z.string().min(20).max(400),
    options: z.array(z.object({text: z.string().min(1).max(250), explanation: z.string().min(30).max(600)})).length(3),
    answer: z.number().int().min(0).max(2), sourceIds, claimIds: z.array(z.string()).min(1).max(4),
  })).length(3),
});
export type SubjectLesson = z.infer<typeof subjectLessonSchema>;
/** Verbatim audit excerpts remain private; readers receive original explanations and source links. */
export const subjectPublicLessonSchema=subjectLessonSchema.extend({
  claims:z.array(subjectLessonSchema.shape.claims.element.omit({evidence:true})).min(8).max(18),
});
export type SubjectPublicLesson=z.infer<typeof subjectPublicLessonSchema>;
export const publishedSubjectSourceSchema=z.object({
  id:z.string().min(1),label:z.string().min(1),url:z.string().url(),digest:z.string().regex(/^[a-f0-9]{64}$/),
  extractionVersion:z.string().min(1).optional(),capturedAt:z.string().datetime().optional(),
});
export type PublishedLesson = SubjectPublicLesson & {
  id: string; createdAt: string; pipelineVersion: string;
  sources: z.infer<typeof publishedSubjectSourceSchema>[];
  review: {status: "passed"; reviewedAt: string; contentDigest: string};
};
export type SubjectListing = SubjectEntry & {status: "available" | "pending" | "failed"; summary: string; words: number};

/** Relationship checks are necessary but do not establish scientific correctness. */
export function validateSubjectLesson(lesson: SubjectLesson, sources: {id: string; excerpt: string}[]) {
  subjectLessonSchema.parse(lesson);
  if (!/[.!?]$/.test(lesson.summary.trim())) throw new Error("Lesson summary must end with a complete sentence");
  const evidence = new Map(sources.map(source => [source.id, source.excerpt]));
  const claims = new Set(lesson.claims.map(claim => claim.id));
  const sections = new Set(lesson.sections.map(section => section.id));
  const figures = new Set(lesson.figures.map(figure => figure.id));
  if (claims.size !== lesson.claims.length || sections.size !== lesson.sections.length || figures.size !== lesson.figures.length) throw new Error("Duplicate lesson identity");
  const checkSources = (ids: string[]) => { if (ids.some(id => !evidence.has(id))) throw new Error("Unknown evidence reference"); };
  const checkClaims = (ids: string[]) => { if (ids.some(id => !claims.has(id))) throw new Error("Unknown claim reference"); };
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  for (const claim of lesson.claims) {
    checkSources(claim.sourceIds);
    if (!claim.sourceIds.some(id => normalize(evidence.get(id)!).includes(normalize(claim.evidence)))) throw new Error(`Claim ${claim.id} lacks an exact evidence passage`);
  }
  for (const section of lesson.sections) {
    checkSources(section.sourceIds); checkClaims(section.claimIds);
    if (section.figureId !== null && !figures.has(section.figureId)) throw new Error("Unknown figure reference");
  }
  for (const figure of lesson.figures) {
    checkSources(figure.sourceIds); checkClaims(figure.claimIds);
    if (lesson.sections.filter(section => section.figureId === figure.id).length !== 1) throw new Error("Figure must appear in exactly one section");
  }
  for (const question of lesson.quiz) {
    checkSources(question.sourceIds); checkClaims(question.claimIds);
    if (new Set(question.options.map(option => option.text.trim().toLowerCase())).size !== 3) throw new Error("Quiz options repeat");
  }
  const wordCount = lesson.sections.reduce((sum, section) => sum + section.markdown.split(/\s+/).length, 0);
  if (wordCount < 1100 || wordCount > 4200) throw new Error("Lesson must contain 1100–4200 words of substantive teaching");
}

export const topicDescriptions: Record<typeof subjectTopics[number], string> = {
  Diffusion: "Noise, probability, and the paths from randomness to structure.",
  Architecture: "How networks move information and retain useful state.",
  Training: "What changes during learning, and how to make it efficient.",
  LLMs: "Language modeling, adaptation, retrieval, and serving.",
  Vision: "Representations of images, video, and three-dimensional scenes.",
  "RL & alignment": "Learning decisions from rewards, models, and preferences.",
  Multimodal: "Connecting language with images, audio, and action.",
  Theory: "The assumptions and mathematics behind learning systems.",
};
