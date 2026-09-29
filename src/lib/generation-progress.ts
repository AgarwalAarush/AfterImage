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
        ? "The notecard, visual guide, and questions will appear together when they are ready."
        : copy[stage].detail,
    orbState:
      paper.generationStatus === "queued" ? "working" : orbByStage[stage],
    retryAction: null,
    steps: progress(activeIndex),
  };
}

/**
 * Projects the two dependent worker jobs as one reader-facing package.
 * Generated notecards remain hidden until their study guide and quiz finish.
 */
export function paperPreparationModel(
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
          ? "The notecard passed review. The final part of your reading kit will start shortly."
          : "Creating source-grounded visuals and review questions before the complete paper unlocks.",
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
      title: "The reading kit didn’t pass review.",
      detail:
        "The notecard did not finish, so the visual guide was not started. Nothing partial was published.",
      orbState: "solving",
      retryAction: "generate",
      steps: progress(failedIndex, true),
    };
  }

  if (paper.recall && latestStudy?.status === "failed")
    return {
      status: "failed",
      title: "The visual study guide didn’t pass review.",
      detail:
        "The notecard is safe, but the complete package stays hidden until its visuals and questions are ready.",
      orbState: "weaving",
      retryAction: "study",
      steps: progress(4, true),
    };

  if (paper.recall)
    return {
      status: "idle",
      title: "Finish preparing this paper.",
      detail:
        "The notecard is ready. Add its visual guide and questions to unlock the complete reading kit.",
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
