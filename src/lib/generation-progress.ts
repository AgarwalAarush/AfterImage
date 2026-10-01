import type { GenerationStep, Job, Paper } from "./types";

export type ProgressState = "complete" | "active" | "failed" | "upcoming";
export type PreparationStepId = GenerationStep | "study";
export type PreparationOrbState =
  | "working"
  | "breathing"
  | "searching"
  | "shaping"
  | "composing"
  | "solving"
  | "weaving";

export type PreparationStep = {
  id: PreparationStepId;
  label: string;
  state: ProgressState;
};

export type PaperPreparationModel = {
  status: "ready" | "queued" | "running" | "failed" | "idle";
  title: string;
  detail: string;
  orbState: PreparationOrbState;
  retryAction: "generate" | "study" | null;
  steps: PreparationStep[];
  readable?: boolean;
  startedAt?: string;
  activityAt?: string;
  queuePosition?: number;
  workerState?: "online" | "unconfirmed" | "offline";
  attempt?: number;
};

const stages: Array<Pick<PreparationStep, "id" | "label">> = [
  { id: "sources", label: "Evidence" },
  { id: "planning", label: "Explanation" },
  { id: "drafting", label: "Notecard" },
  { id: "reviewing", label: "Notecard review" },
  { id: "study", label: "Visual guide + quiz" },
];

const orbByStage: Record<PreparationStepId, PreparationOrbState> = {
  sources: "searching",
  planning: "shaping",
  drafting: "composing",
  reviewing: "solving",
  study: "weaving",
};

function progress(activeIndex: number, failed = false): PreparationStep[] {
  return stages.map((item, index) => ({
    ...item,
    state:
      index < activeIndex
        ? "complete"
        : index === activeIndex
          ? failed
            ? "failed"
            : "active"
          : "upcoming",
  }));
}

function generationModel(paper: Paper): PaperPreparationModel {
  const stage = paper.generationStep || "sources";
  const activeIndex = Math.max(
    0,
    stages.findIndex((item) => item.id === stage),
  );
  const copy: Record<GenerationStep, { title: string; detail: string }> = {
    sources: {
      title: "Gathering the paper’s evidence.",
      detail: "Pulling the sections that will support the explanation and visuals.",
    },
    planning: {
      title: "Finding the clearest explanation.",
      detail: "Mapping the mechanism before the notecard and diagrams are composed.",
    },
    drafting: {
      title: "Composing the notecard.",
      detail: "Turning the source material into a concise technical refresher.",
    },
    reviewing: {
      title: "Checking the notecard.",
      detail: "Reviewing citations, equations, and diagram layout before moving on.",
    },
  };
  return {
    status: paper.generationStatus === "queued" ? "queued" : "running",
    title:
      paper.generationStatus === "queued"
        ? "Your paper is in the preparation queue."
        : copy[stage].title,
    detail:
      paper.generationStatus === "queued"
        ? "The worker will prepare and review your notecard first, then its visual guide and questions."
        : copy[stage].detail,
    orbState:
      paper.generationStatus === "queued" ? "working" : orbByStage[stage],
    retryAction: null,
    steps: progress(activeIndex),
  };
}

/**
 * Projects validated notecard and study jobs without exposing unreviewed drafts.
 */
function preparationModel(
  paper: Paper,
  jobs: Job[],
): PaperPreparationModel {
  const paperJobs = jobs.filter((job) => job.paperId === paper.id);
  const activeGenerate = paperJobs.find(
    (job) => job.type === "generate" && ["queued", "running"].includes(job.status),
  );
  const activeStudy = paperJobs.find(
    (job) => job.type === "study" && ["queued", "running"].includes(job.status),
  );
  const latestStudy = paperJobs.filter((job) => job.type === "study").at(-1);

  if (activeGenerate) return generationModel(paper);

  if (activeStudy)
    return {
      status: activeStudy.status === "queued" ? "queued" : "running",
      title:
        activeStudy.status === "queued"
          ? "The visual study guide is next."
          : "Building the visual guide and quiz.",
      detail:
        activeStudy.status === "queued"
          ? "The notecard passed review and is ready to read. The visual guide and questions are queued."
          : "Your reviewed notecard is ready to read while the visuals and questions are prepared.",
      orbState: activeStudy.status === "queued" ? "working" : "weaving",
      retryAction: null,
      steps: progress(4),
    };

  // Editorial starter papers predate the generated package pipeline. A stored
  // study marks generated papers as atomically complete.
  if (
    paper.recall &&
    (paper.recall.provenance === "editorial" || Boolean(paper.study))
  )
    return {
      status: "ready",
      title: "Your paper is ready.",
      detail: "",
      orbState: "breathing",
      retryAction: null,
      steps: progress(stages.length),
    };

  if (paper.generationStatus === "failed") {
    const failedStage = paper.generationStep || "reviewing";
    const failedIndex = Math.max(
      0,
      stages.findIndex((item) => item.id === failedStage),
    );
    return {
      status: "failed",
      title: failedStage === "reviewing" ? "Prepare a fresh reading kit." : "Preparation was interrupted.",
      detail:
        failedStage === "reviewing"
          ? "The previous attempt did not produce a reviewed notecard. You can request a new pass, or read the original paper."
          : "The last attempt stopped before the notecard was reviewed. You can request a new pass, or read the original paper.",
      orbState: "solving",
      retryAction: "generate",
      steps: progress(failedIndex, true),
    };
  }

  if (paper.recall && latestStudy?.status === "failed")
    return {
      status: "failed",
      title: "The study guide needs a fresh pass.",
      detail:
        "Your reviewed notecard remains available. Retry to finish the visuals and questions.",
      orbState: "weaving",
      retryAction: "study",
      steps: progress(4, true),
    };

  if (paper.recall)
    return {
      status: "idle",
      title: "Finish preparing this paper.",
      detail:
        "The reviewed notecard is ready to read. Add its visual guide and questions when you want them.",
      orbState: "breathing",
      retryAction: "study",
      steps: progress(4),
    };

  return {
    status: "idle",
    title: "Prepare this paper for reading.",
    detail:
      "Create a reviewed notecard, visual study guide, and quiz as one complete package.",
    orbState: "breathing",
    retryAction: "generate",
    steps: progress(0),
  };
}

const studyStages: Record<string, {title: string; detail: string}> = {
  "study-sources": {title: "Gathering evidence for the study guide.", detail: "Refreshing the source excerpts for the visuals and questions."},
  "study-drafting": {title: "Drafting the visuals and questions.", detail: "Creating examples and questions grounded in the paper’s evidence."},
  "study-rendering": {title: "Checking the figure layouts.", detail: "Rendering desktop and mobile figures and checking their geometry."},
  "study-reviewing": {title: "Reviewing the visuals and answers.", detail: "Checking the rendered figures, citations, and every quiz answer against the sources."},
  "study-repairing": {title: "Improving the study guide after review.", detail: "The last draft needs corrections. The worker is preparing a revised version before publishing."},
  publishing: {title: "Saving the reviewed result.", detail: "The checks passed. Your reading kit will update automatically."},
};
export function paperPreparationModel(paper: Paper, jobs: Job[], workerSeenAt?: string | null, now = Date.now()): PaperPreparationModel {
  const model = preparationModel(paper, jobs);
  const job = jobs.find(j => j.paperId === paper.id && ["generate", "study"].includes(j.type) && ["queued", "running"].includes(j.status));
  const readable = Boolean(paper.recall);
  if (!job) return {...model, readable};
  // Legacy workers expose a lease but no heartbeat timestamp. Derive their last
  // renewal from the existing 15-minute lease; do not interpret a lease as ETA.
  const legacyHeartbeat = job.leaseUntil ? Date.parse(job.leaseUntil) - 15 * 60000 : NaN;
  const activityAt = job.heartbeatAt || (Number.isFinite(legacyHeartbeat) ? new Date(legacyHeartbeat).toISOString() : job.startedAt);
  const seen = Date.parse((job.status === "running" ? activityAt : workerSeenAt) || "");
  const workerState = !Number.isFinite(seen) ? "unconfirmed" : now - seen > 150000 ? "offline" : "online";
  const stage = job.status === "running" && job.stage ? studyStages[job.stage] : undefined;
  return {...model, ...stage, readable, startedAt: job.startedAt || job.createdAt, activityAt,
    workerState, attempt: job.progressAttempt,
    queuePosition: job.status === "queued" ? jobs.filter(j => j.status === "queued").findIndex(j => j.id === job.id) + 1 : undefined,
  };
}
