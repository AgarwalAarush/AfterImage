import type { AssistantRequest } from "./assistant";
import type { StudyPack } from "./study";

export type ReadingStatus = "saved" | "reading" | "read" | "archived";
export type Accent = "violet" | "ochre" | "blue" | "sage";
export type SceneNode = {
  id: string;
  kind: "box" | "circle" | "matrix" | "stack" | "experts";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  detail: string;
  emphasis: boolean;
};
export type SceneEdge = {
  from: string;
  to: string;
  label: string;
  dashed: boolean;
};
export type Scene = {
  title: string;
  description: string;
  footnote: string;
  nodes: SceneNode[];
  edges: SceneEdge[];
};
export type Source = {
  id: string;
  label: string;
  url: string;
  excerpt: string;
};
export type Recall = {
  version?: 2;
  equations?: { title?: string | null; latex: string; explanation: string; example?: string | null; sourceId: string }[];
  walkthrough?: {
    title: string;
    introduction: string;
    steps: { label: string; input: string; operation: string; output: string }[];
    sourceId: string;
  } | null;
  significance?: string;
  idea: string;
  problem: string;
  mechanism: string;
  evidence: string;
  limitation: string;
  sourceIds: string[];
  provenance: "editorial" | "codex";
  evidenceScope: "abstract" | "full-text";
  generatedAt?: string;
};
export type Paper = {
  id: string;
  arxivId: string;
  title: string;
  authors: string;
  year: number;
  topics: string[];
  accent: Accent;
  abstract: string;
  recall: Recall | null;
  study?: StudyPack;
  scene: Scene | null;
  sources: Source[];
  visual?:
    | "experts"
    | "lora"
    | "attention"
    | "contrastive"
    | "pruning"
    | "memory";
  generationStatus: "ready" | "idle" | "queued" | "running" | "failed";
  generationError?: string;
  createdAt: string;
};
export type Entry = {
  paperId: string;
  status: ReadingStatus;
  takeaway: string;
  why: string;
  question: string;
  nextAction: string;
  savedAt: string;
  updatedAt: string;
  reviewedAt?: string;
};
export type Direction = {
  goal: string;
  questions: string;
  topics: string[];
  background?: string;
  readingContext?: string;
  updatedAt?: string;
};
export type RecommendationRun = {
  candidateCount: number;
  suggestedLinkCount: number;
  resolvedLinkCount: number;
  unresolvedIds: string[];
  searches: { query: string; status: "ok" | "unavailable"; source?: "api" | "website" }[];
  directionUpdatedAt: string;
};
export type Recommendation = {
  paperId: string;
  role: string;
  reason: string;
  focus: string;
  depth: string;
};
export type Feedback = {
  paperId: string;
  value: "useful" | "known" | "advanced" | "irrelevant" | "later";
  at: string;
};
export type Job = {
  id: string;
  type: "generate" | "recommend" | "study";
  paperId?: string;
  status: "queued" | "running" | "complete" | "failed";
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  leaseUntil?: string;
  leaseToken?: string;
  attempts: number;
  error?: string;
};
export type AppState = {
  schemaVersion: 1;
  assistantRequests?: AssistantRequest[];
  papers: Paper[];
  entries: Record<string, Entry>;
  direction: Direction;
  recommendations: Recommendation[];
  recommendationSource: "starter" | "codex";
  recommendedAt: string | null;
  recommendationRun?: RecommendationRun;
  feedback: Feedback[];
  jobs: Job[];
  workerSeenAt: string | null;
  onboardingDone: boolean;
};
