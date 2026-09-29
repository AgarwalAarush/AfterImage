import { studySchema, validateStudy } from "@/lib/study";
import { NextResponse } from "next/server";
import { workerAuth } from "@/lib/auth";
import { mutate, touchWorkerSeenAt, workerClaimStatus } from "@/lib/store";
import { resultSchema, recommendationSchema, validateScene } from "@/lib/scene";
import { randomUUID } from "node:crypto";
import { importPaper } from "@/lib/papers";
import { validateRecall } from "@/lib/recall-validation";
import { parsePaperId } from "@/lib/identity";
import { excludedRecommendations, recommendationRunSchema } from "@/lib/recommendations";
import { z } from "zod";
export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!workerAuth(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === "claim") {
      const status = await workerClaimStatus();
      if (!status.claim) {
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
        const job = s.jobs.find((j) => j.status === "queued");
        if (!job) return { job: null };
        job.status = "running";
        job.attempts++;
        job.startedAt = now;
        job.leaseUntil = new Date(Date.now() + 15 * 60000).toISOString();
        job.leaseToken = randomUUID();
        const p = s.papers.find((p) => p.id === job.paperId);
        if (p && job.type === "generate") {
          p.generationStatus = "running";
          p.generationStep = "sources";
        }
        return {
          job,
          paper: p,
          direction: s.direction,
          papers: s.papers,
          entries: s.entries,
          feedback: s.feedback,
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
        job.leaseUntil = new Date(Date.now() + 15 * 60000).toISOString();
        const stage = z
          .enum(["sources", "planning", "drafting", "reviewing"])
          .safeParse(body.stage);
        const p = s.papers.find((p) => p.id === job.paperId);
        if (p && job.type === "generate" && stage.success)
          p.generationStep = stage.data;
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
      if (job.type === "study") {
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
        if (report && report.directionUpdatedAt !== (s.direction.updatedAt || ""))
          throw new Error("Your direction changed during discovery. Request a new shortlist.");
        for (const p of newPapers)
          if (!s.papers.some((x) => x.id === p.id)) s.papers.push(p);
        const result = recommendationSchema.parse(body.result);
        const seen = new Set<string>();
        const excluded = excludedRecommendations(s);
        for (const r of result.recommendations) {
          if (!s.papers.some((p) => p.id === r.paperId) || seen.has(r.paperId) || excluded.has(r.paperId))
            throw new Error("Invalid recommended paper");
          seen.add(r.paperId);
        }
        s.recommendations = result.recommendations;
        s.recommendationSource = "codex";
        s.recommendedAt = now;
        s.recommendationRun = report;
        for (const rec of result.recommendations) {
          const p = s.papers.find((p) => p.id === rec.paperId)!;
          if (
            !p.recall &&
            !s.jobs.some(
              (j) =>
                j.paperId === p.id && ["queued", "running"].includes(j.status),
            ) &&
            s.jobs.filter((j) => Date.now() - Date.parse(j.createdAt) < 3600000)
              .length < 12
          ) {
            s.jobs.push({
              id: randomUUID(),
              type: "generate",
              paperId: p.id,
              status: "queued",
              createdAt: now,
              attempts: 0,
            });
            p.generationStatus = "queued";
            delete p.generationStep;
          }
        }
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
