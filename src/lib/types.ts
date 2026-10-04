import type { AssistantRequest } from "./assistant";
import type { StudyPack } from "./study";
import type { Illustration } from "./scene-illustration";

export type ReadingStatus = "saved" | "reading" | "read" | "archived";
export type Accent = "violet" | "ochre" | "blue" | "sage";
export type GenerationStatus = "ready" | "idle" | "queued" | "running" | "failed";
export type GenerationStep = "sources" | "planning" | "drafting" | "reviewing";
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
  layout?: "flow-v2" | "explanatory-v3";
  illustration?: Illustration | null;
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
  generationStatus: GenerationStatus;
  /** Worker-reported milestone used for calm, reader-facing generation feedback. */
  generationStep?: GenerationStep;
  generationError?: string;
  createdAt: string;
};
export type Entry = {
  paperId: string;
  status: ReadingStatus;
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
  discoveredCount?: number;
  recentCandidateCount?: number;
  suggestedLinkCount: number;
  resolvedLinkCount: number;
  unresolvedIds: string[];
  searches: {
    query: string;
    lane?: "relevance" | "recent";
    status: "ok" | "unavailable";
    source?: "api" | "website";
    providers?: {
      provider: "arxiv-api" | "arxiv-website" | "openalex";
      status: "ok" | "unavailable";
      resultCount: number;
      candidateCount: number;
    }[];
  }[];
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
  eventId?: string;
  profileRevision?: number;
  undoneAt?: string;
  paperId: string;
  value: "useful" | "known" | "advanced" | "irrelevant" | "later";
  at: string;
};
export type WorkerStage = GenerationStep | "study-sources" | "study-drafting" | "study-rendering" | "study-reviewing" | "study-repairing" | "publishing";
export type Job = {
  id: string;
  type: "generate" | "recommend" | "study" | "interests";
  paperId?: string;
  status: "queued" | "running" | "complete" | "failed";
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  leaseUntil?: string;
  leaseToken?: string;
  attempts: number;
  /** Automatic discovery fills vacant slots; an explicit refresh replaces the shortlist. */
  recommendationMode?: "refill";
  preferenceRevision?: number;
  /** Private inputs bound at claim; excluded from browser state. */
  interestEvidenceFingerprint?: string;
  interestFollowup?: boolean;
  searchCycle?: number;
  /** A reading/dismissal action arrived after this recommendation job was claimed. */
  recommendationRefillRequested?: boolean;
  stage?: WorkerStage;
  stageUpdatedAt?: string;
  heartbeatAt?: string;
  progressAttempt?: number;
  error?: string;
};
export type AppState = {
  schemaVersion: 2;
  preferences?: import("./preferences").PreferenceLedger;
  preferenceSummary?: import("./preferences").PreferenceSummary;
  recommendationReceipts?: unknown[];
  recommendationSearchCycle?: number;
  /** Private interest assignment keeps semantic recommendations responsive to Off. */
  recommendationInterestAssignments?: Record<string, string>;
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
