import { ensurePreferences } from "@/lib/preferences";
import { interestSuggestionInput, queueInterestDiscovery, publishInterestSuggestions, interestSuggestionResultSchema, sufficientInterestEvidence } from "@/lib/interest-suggestions";
import { studySchema, validateStudy } from "@/lib/study";
import { NextResponse } from "next/server";
import { workerAuth } from "@/lib/auth";
import { mutate, touchWorkerSeenAt, workerClaimStatus } from "@/lib/store";
import { resultSchema, recommendationSchema, validateScene } from "@/lib/scene";
import { validateIllustrationSources } from "@/lib/scene-illustration";
import { randomUUID } from "node:crypto";
import { importPaper } from "@/lib/papers";
import { validateRecall } from "@/lib/recall-validation";
import { parsePaperId } from "@/lib/identity";
import { nextQueuedJob, queueRecommendationRefill, publishRecommendations, recommendationRunSchema, recommendationReceiptSchema } from "@/lib/recommendations";
import type { Job, Paper } from "@/lib/types";
import { recordWorkerProgress } from "@/lib/worker-progress";
export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Discovery renews every minute; recover interrupted short jobs sooner than reading kits.
function leaseUntil(type: Job["type"]) {
  return new Date(Date.now() + (["recommend", "interests"].includes(type) ? 3 : 15) * 60000).toISOString();
}
export async function POST(req: Request) {
  if (!workerAuth(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const supportsInterests = Array.isArray(body.capabilities) && body.capabilities.includes("dynamic-interests-v1");
    if (body.action === "claim") {
      const status = await workerClaimStatus();
      if (!status.claim && !(supportsInterests && status.heartbeat)) {
        if (status.heartbeat) await touchWorkerSeenAt();
        return NextResponse.json({job: null});
      }
    }
    const newPapers =
      body.action === "complete" && Array.isArray(body.newPaperIds)
        ? await Promise.all(
            body.newPaperIds
              .slice(0, 3)
              .map((id: string) => importPaper(parsePaperId(id))),
          )
        : [];
    const result = await mutate((s) => {
      const now = new Date().toISOString();
      if (body.action !== "claim" || Date.now() - Date.parse(s.workerSeenAt || "1970-01-01") > 60000)
        s.workerSeenAt = now;
      if (body.action === "claim") {
        for (const job of s.jobs) {
          if (
            job.status === "running" &&
            Date.parse(job.leaseUntil || "") < Date.now()
          ) {
            job.status = job.attempts >= 3 ? "failed" : "queued";
            if (job.status === "failed") {
              job.error = "Worker could not finish after three attempts.";
              const p = s.papers.find((p) => p.id === job.paperId);
              if (p && job.type === "generate") {
                p.generationStatus = "failed";
                p.generationError = job.error;
              }
            }
          }
        }
        // Passive reading writes stay acknowledgement-only. Compatible idle workers
        // reconcile evidence during their existing minute heartbeat/claim cadence.
        if (supportsInterests) {
          const profile = ensurePreferences(s);
          const input = interestSuggestionInput(s);
          if (!profile.enabled || !sufficientInterestEvidence(input.papers)) {
            for (const pending of s.jobs.filter(j => j.type === "interests" && j.status === "queued")) {
              // Cancellation before inference is not a model attempt. A later explicit
              // enable/new evidence may schedule it again under the normal budget.
              const fingerprint = pending.interestEvidenceFingerprint;
              if (profile.interestDiscovery) profile.interestDiscovery.attemptedFingerprints = profile.interestDiscovery.attemptedFingerprints?.filter(value => value !== fingerprint);
              pending.status = "complete";
              pending.finishedAt = now;
              delete pending.interestEvidenceFingerprint;
            }
          } else queueInterestDiscovery(s, now, randomUUID);
        }
        const needsDynamicWorker = ensurePreferences(s).interests.some(i => i.id.startsWith("topic-"));
        const claimableJobs = supportsInterests || !needsDynamicWorker ? s.jobs : s.jobs.filter(j => j.type !== "recommend");
        const job = nextQueuedJob(claimableJobs, supportsInterests);
        if (!job) return { job: null };
        if (job.type === "recommend" || job.type === "interests") job.preferenceRevision = ensurePreferences(s).revision;
        if (job.type === "recommend" && job.searchCycle === undefined) {
          job.searchCycle = s.recommendationSearchCycle || 0;
          s.recommendationSearchCycle = job.searchCycle + 1;
        }
        const interestInput = job.type === "interests" ? interestSuggestionInput(s) : undefined;
        if (interestInput) {
          job.interestEvidenceFingerprint = interestInput.digest;
          // Queued evidence can change before claim. Retain the digest actually sent
          // to inference so a failed run cannot return after job history is trimmed.
          const discovery = ensurePreferences(s).interestDiscovery!;
          discovery.attemptedFingerprints ||= [];
          if (!discovery.attemptedFingerprints.includes(interestInput.digest))
            discovery.attemptedFingerprints.push(interestInput.digest);
        }
        job.status = "running";
        job.attempts++;
        job.startedAt = now;
        job.heartbeatAt = now;
        delete job.stage;
        delete job.stageUpdatedAt;
        delete job.progressAttempt;
        job.leaseUntil = leaseUntil(job.type);
        job.leaseToken = randomUUID();
        const p = s.papers.find((p) => p.id === job.paperId);
        if (p && job.type === "generate") {
          p.generationStatus = "running";
          p.generationStep = "sources";
        }
        if (interestInput) return {job, interestInput};
        return {
          job,
          recommendationCycle: job.searchCycle,
          paper: p,
          direction: s.direction,
          papers: s.papers,
          entries: s.entries,
          feedback: s.feedback,
          recommendations: s.recommendations,
          preferences: job.type === "recommend" ? s.preferences : undefined,
        };
      }
      const job = s.jobs.find((j) => j.id === body.jobId);
      if (
        !job ||
        job.status !== "running" ||
        job.leaseToken !== body.leaseToken
      )
        throw new Error("Job lease is no longer valid");
      if (body.action === "heartbeat") {
        job.leaseUntil = leaseUntil(job.type);
        recordWorkerProgress(job, body, now);
        const p = s.papers.find((p) => p.id === job.paperId);
        if (p && job.type === "generate" && job.stage &&
            ["sources", "planning", "drafting", "reviewing"].includes(job.stage))
          p.generationStep = job.stage as NonNullable<Paper["generationStep"]>;
        return { ok: true };
      }
      if (body.action === "fail") {
        job.status = "failed";
        job.error = String(body.error || "Generation failed").slice(0, 300);
        const p = s.papers.find((p) => p.id === job.paperId);
        if (p && job.type === "generate") {
          p.generationStatus = "failed";
          p.generationError = job.error;
        }
        job.finishedAt = now;
        return { ok: true };
      }
      if (body.action !== "complete") throw new Error("Unknown worker action");
      if (job.type === "interests") {
        const published = publishInterestSuggestions(s, job, interestSuggestionResultSchema.parse(body.interestSuggestions), now, randomUUID);
        job.finishedAt = now;
        delete job.leaseToken;
        return {ok: true, staleInterests: !published};
      } else if (job.type === "study") {
        const pack=studySchema.parse(body.study);
        const p=s.papers.find(p=>p.id===job.paperId);
        if(!p)throw new Error("Paper not found");
        const sources=body.sources||p.sources;
        if(!Array.isArray(sources)||sources.length>14||sources.some((s:any)=>typeof s.id!=="string"||typeof s.label!=="string"||typeof s.excerpt!=="string"||s.excerpt.length>10000||typeof s.url!=="string"||!s.url.startsWith("https://arxiv.org/")))throw new Error("Invalid study sources");
        validateStudy(pack,sources);
        if(p.recall)validateRecall(p.recall,sources);
        p.sources=sources;p.study=pack;
      } else if (job.type === "generate") {
        const result = resultSchema.parse(body.result);
        validateScene(result.scene);
        const p = s.papers.find((p) => p.id === job.paperId)!;
        const sources = body.sources;
        if (!Array.isArray(sources) || sources.length > 14)
          throw new Error("Invalid sources");
        for (const src of sources) {
          if (
            typeof src.id !== "string" ||
            typeof src.label !== "string" ||
            typeof src.excerpt !== "string" ||
            src.excerpt.length > 10000 ||
            typeof src.url !== "string" ||
            !src.url.startsWith("https://arxiv.org/")
          )
            throw new Error("Invalid source record");
        }
        if (
          result.recall.sourceIds.some(
            (id) => !sources.some((src) => src.id === id),
          )
        )
          throw new Error("Unknown source citation");
        validateRecall(result.recall, sources);
        if (result.scene.illustration) validateIllustrationSources(result.scene.illustration, sources);
        p.recall = {
          ...result.recall,
          provenance: "codex",
          evidenceScope: body.scope === "full-text" ? "full-text" : "abstract",
          generatedAt: now,
        };
        p.scene = result.scene;
        p.sources = sources;
        p.generationStatus = "ready";
        delete p.generationStep;
        delete p.generationError;
        // Each new notecard gets its own independently reviewed visual/quiz supplement.
        if(!s.jobs.some(j=>j.type==="study"&&j.paperId===p.id&&["queued","running"].includes(j.status)))
          s.jobs.push({id:randomUUID(),type:"study",paperId:p.id,status:"queued",createdAt:now,attempts:0});
      } else {
        const report = body.report ? recommendationRunSchema.parse(body.report) : undefined;
        const profileChanged = job.preferenceRevision !== undefined && job.preferenceRevision !== ensurePreferences(s).revision;
        if (profileChanged) {
          publishRecommendations(s,[],job,now,randomUUID);
          job.finishedAt = now;
          delete job.leaseToken;
          return {ok: true, stalePreferences: true};
        }
        if (report && report.directionUpdatedAt !== (s.direction.updatedAt || "")) {
          job.status = "complete";
          queueRecommendationRefill(s,now,randomUUID);
          return {ok: true, stalePreferences: true};
        }
        for (const p of newPapers)
          if (!s.papers.some((x) => x.id === p.id)) s.papers.push(p);
        if (ensurePreferences(s).enabled && (!body.receipt || job.preferenceRevision === undefined))
          throw new Error("Compatible reviewed discovery worker required");
        const result = recommendationSchema.parse(body.result);
        const seen = new Set<string>();
        for (const r of result.recommendations) {
          if (!s.papers.some((p) => p.id === r.paperId) || seen.has(r.paperId))
            throw new Error("Invalid recommended paper");
          seen.add(r.paperId);
        }
        if (body.receipt) {
          const receipt = recommendationReceiptSchema.parse(body.receipt);
          if (receipt.profileRevision !== job.preferenceRevision || receipt.learningEnabled !== ensurePreferences(s).enabled) throw new Error("Preference receipt mismatch");
          for (const rec of result.recommendations) {
            const canonical = ensurePreferences(s).features[rec.paperId];
            const verdict = receipt.grounding.filter(v => v.paperId === rec.paperId).at(-1);
            const ranking = receipt.ranking.find(r => r.paperId === rec.paperId && r.metadataDigest === canonical?.digest && r.relevance >= 0.6);
            if (!canonical || !ranking || ranking.metadataDigest !== canonical.digest || ranking.relevance < 0.6 || !verdict || verdict.metadataDigest !== canonical.digest || !verdict.identity || !verdict.reason || !verdict.focus)
              throw new Error("Grounding receipt mismatch");
            const interests = ensurePreferences(s).interests;
            if (interests.some(i => i.id.startsWith("topic-")) && (!ranking.interestId || !verdict.interest || !verdict.respectsDisabledInterests))
              throw new Error("Compatible dynamic interest review required");
            if (ranking.interestId && ranking.interestId !== "research-direction" && !interests.some(i => i.id === ranking.interestId && i.strength !== "off"))
              throw new Error("Inactive recommendation interest");
            if (ranking.interestId) (s.recommendationInterestAssignments ||= {})[rec.paperId] = ranking.interestId;
          }
          s.recommendationReceipts = [...(s.recommendationReceipts || []),receipt].slice(-30);
        }
        publishRecommendations(s, result.recommendations, job, now, randomUUID);
        const visible = new Set(s.recommendations.map(rec => rec.paperId));
        s.recommendationInterestAssignments = Object.fromEntries(Object.entries(s.recommendationInterestAssignments || {}).filter(([id]) => visible.has(id)));
        s.recommendationSource = "codex";
        s.recommendedAt = now;
        s.recommendationRun = report;
        // Discovery publishes metadata only. The reader explicitly requests a kit.
      }
      job.status = "complete";
      job.finishedAt = now;
      delete job.leaseToken;
      return { ok: true };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
