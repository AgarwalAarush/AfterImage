import { componentIdSchema, paperKit } from "@/lib/kit";
import { markKitComponent } from "@/lib/kit-publication";
import { NextResponse } from "next/server";
import { authenticated, sameOrigin } from "@/lib/auth";
import { mutate, publicState, snapshot, stateStatus } from "@/lib/store";
import { parsePaperId } from "@/lib/identity";
import { importPaper } from "@/lib/papers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Paper } from "@/lib/types";
import { excludedRecommendations, shouldRefreshRecommendations } from "@/lib/recommendations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!(await authenticated()))
    return NextResponse.json(
      { error: "Sign in to your library." },
      { status: 401 },
    );
  try {
    const params = new URL(req.url).searchParams;
    const since = params.get("since");
    if (params.get("full") !== "1" && since !== null && /^\d+$/.test(since)) {
      const status = await stateStatus();
      if (Number(since) === status.version)
        return new Response(null, {status: 204, headers: {
          "Cache-Control": "private, no-store",
          "X-Afterimage-Worker-Seen-At": status.workerSeenAt || "",
        }});
    }
    const {version, data} = await snapshot();
    return NextResponse.json(publicState(data, params.get("full") === "1"), {
      headers: { "Cache-Control": "private, no-store", "X-Afterimage-State-Version": String(version) },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
}
export async function POST(req: Request) {
  if (!(await authenticated()))
    return NextResponse.json(
      { error: "Sign in to your library." },
      { status: 401 },
    );
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const body = await req.json(),
      now = new Date().toISOString();
    let imported: Paper | undefined;
    if (body.action === "import") {
      const id = parsePaperId(String(body.url));
      const existing = (await snapshot()).data.papers.find((p) => p.id === id);
      imported = existing || (await importPaper(id));
    }
    const result = await mutate((s) => {
      const id = String(body.paperId || imported?.id || "");
      const paper = s.papers.find((p) => p.id === id);
      const ensureEntry = () => {
        if (!paper && !imported) throw new Error("Paper not found");
        return (s.entries[id] ||= {
          paperId: id,
          status: "saved",
          savedAt: now,
          updatedAt: now,
        });
      };
      const refreshFromReading = () => {
        if (!shouldRefreshRecommendations(s)) return;
        s.jobs.push({
          id: randomUUID(),
          type: "recommend",
          status: "queued",
          createdAt: now,
          attempts: 0,
        });
        s.jobs = s.jobs.slice(-100);
      };
      switch (body.action) {
        case "import":
          if (!s.papers.some((p) => p.id === imported!.id))
            s.papers.push(imported!);
          ensureEntry();
          if (
            !imported!.recall &&
            !s.jobs.some(
              (j) =>
                j.paperId === id && ["queued", "running"].includes(j.status),
            )
          ) {
            if (
              s.jobs.filter(
                (j) => Date.now() - Date.parse(j.createdAt) < 3600000,
              ).length >= 12
            )
              throw new Error(
                "The hourly generation limit has been reached. Try again later.",
              );
            s.jobs.push({
              id: randomUUID(),
              type: "generate",
              paperId: id,
              status: "queued",
              createdAt: now,
              attempts: 0,
            });
            const generated = s.papers.find((p) => p.id === id)!;
            generated.generationStatus = "queued";
            delete generated.generationStep;
          }
          break;
        case "save":
          ensureEntry().status =
            body.status === "reading" ? "reading" : "saved";
          s.recommendations = s.recommendations.filter(r => !excludedRecommendations(s).has(r.paperId));
          break;
        case "status":
          const status = z.enum(["saved", "reading", "read", "archived"]).parse(body.status);
          Object.assign(ensureEntry(), {
            status,
            updatedAt: now,
          });
          s.recommendations = s.recommendations.filter(r => !excludedRecommendations(s).has(r.paperId));
          if (["reading", "read"].includes(status)) refreshFromReading();
          break;
        case "review":
          ensureEntry().reviewedAt = now;
          refreshFromReading();
          break;
        case "direction":
          s.direction = z
            .object({
              goal: z.string().max(3000),
              questions: z.string().max(3000),
              topics: z.array(z.string().max(60)).max(12),
              background: z.string().max(3000).optional(),
              readingContext: z.string().max(20000).optional(),
            })
            .parse(body.direction);
          s.direction.updatedAt = now;
          s.onboardingDone = true;
          break;
        case "feedback": {
          const value = z
            .enum(["useful", "known", "advanced", "irrelevant", "later"])
            .parse(body.value);
          s.feedback.push({ paperId: id, value, at: now });
          if (["known", "irrelevant", "later"].includes(value))
            s.recommendations = s.recommendations.filter(
              (r) => r.paperId !== id,
            );
          if (value === "later") ensureEntry();
          break;
        }
        case "component":
        case "study":
        case "generate":
        case "recommend": {
          const type = z.enum(["generate", "recommend", "study", "component"]).parse(body.action);
          if (type !== "recommend" && !paper) throw new Error("Paper not found");
          if (type !== "recommend") ensureEntry();
          const componentId = type === "component" ? componentIdSchema.parse(body.componentId) : undefined;
          if (componentId && !paperKit(paper!).components.some(c => c.id === componentId)) throw new Error("Unknown component");
          if (componentId && componentId !== "explanation" && !paper!.recall) throw new Error("Prepare the explanation first");
          if (type === "recommend" && !s.direction.goal.trim())
            throw new Error("Add a learning goal first.");
          if (
            s.jobs.some(
              (j) =>
                (j.type === type || type !== "recommend" && ["generate", "study", "component"].includes(j.type)) &&
                (type === "recommend" || j.paperId === id) &&
                ["queued", "running"].includes(j.status),
            )
          )
            break;
          const recent = s.jobs.filter(
            (j) => Date.now() - Date.parse(j.createdAt) < 3600000,
          );
          if (recent.length >= 12)
            throw new Error(
              "The hourly generation limit has been reached. Try again later.",
            );
          s.jobs.push({
            id: randomUUID(),
            type,
            ...(componentId ? { componentId } : {}),
            ...(type !== "recommend" ? { paperId: id } : {}),
            status: "queued",
            createdAt: now,
            attempts: 0,
          });
          if (paper && componentId) markKitComponent(paper, componentId, "pending");
          if (paper && type === "generate") {
            paper.generationStatus = "queued";
            delete paper.generationStep;
            delete paper.generationError;
          }
          s.jobs = s.jobs.slice(-100);
          break;
        }
        default:
          throw new Error("Unknown action");
      }
      return { state: publicState(s), paperId: id };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Please check the form values."
            : (e as Error).message,
      },
      { status: 400 },
    );
  }
}
