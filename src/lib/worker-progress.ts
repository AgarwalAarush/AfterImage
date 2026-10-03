import { z } from "zod";
import type { Job } from "./types";

const stageSchema = z.enum(["sources", "planning", "drafting", "reviewing", "study-sources", "study-drafting", "study-rendering", "study-reviewing", "study-repairing", "publishing"]);
/** Only authenticated, leased worker messages can supply reader-facing milestones. */
export function recordWorkerProgress(job: Job, body: {stage?: unknown; attempt?: unknown}, now: string) {
  job.heartbeatAt = now;
  const stage = stageSchema.safeParse(body.stage);
  if (!stage.success) return;
  if (stage.data !== "publishing" && (job.type === "study" ? !stage.data.startsWith("study-") : !["generate", "component"].includes(job.type) || stage.data.startsWith("study-"))) return;
  if (job.stage !== stage.data || job.progressAttempt !== body.attempt) job.stageUpdatedAt = now;
  job.stage = stage.data;
  const attempt = z.number().int().min(1).max(3).safeParse(body.attempt);
  if (attempt.success) job.progressAttempt = attempt.data;
}
