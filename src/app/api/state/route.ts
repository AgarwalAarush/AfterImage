import { NextResponse } from "next/server";
import { authenticated, sameOrigin } from "@/lib/auth";
import { mutate, publicState, snapshot } from "@/lib/store";
import { parsePaperId } from "@/lib/identity";
import { importPaper } from "@/lib/papers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Paper } from "@/lib/types";
import { excludedRecommendations } from "@/lib/recommendations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const entrySchema = z.object({
  status: z.enum(["saved", "reading", "read", "archived"]).optional(),
  takeaway: z.string().max(8000).optional(),
  why: z.string().max(8000).optional(),
  question: z.string().max(8000).optional(),
  nextAction: z.string().max(2000).optional(),
});
export async function GET(req: Request) {
  if (!(await authenticated()))
    return NextResponse.json(
      { error: "Sign in to your library." },
      { status: 401 },
    );
  try {
    return NextResponse.json(publicState((await snapshot()).data, new URL(req.url).searchParams.get("full") === "1"), {
      headers: { "Cache-Control": "private, no-store" },
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
          takeaway: "",
          why: "",
          question: "",
          nextAction: "",
          savedAt: now,
          updatedAt: now,
        });
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
            s.papers.find((p) => p.id === id)!.generationStatus = "queued";
          }
          break;
        case "save":
          ensureEntry().status =
            body.status === "reading" ? "reading" : "saved";
          s.recommendations = s.recommendations.filter(r => !excludedRecommendations(s).has(r.paperId));
          break;
        case "entry":
          Object.assign(ensureEntry(), entrySchema.parse(body.patch), {
            updatedAt: now,
          });
          s.recommendations = s.recommendations.filter(r => !excludedRecommendations(s).has(r.paperId));
          break;
        case "review":
          ensureEntry().reviewedAt = now;
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
        case "study":
        case "generate":
        case "recommend": {
          const type = z.enum(["generate", "recommend", "study"]).parse(body.action);
          if (type !== "recommend" && !paper) throw new Error("Paper not found");
          if (type === "recommend" && !s.direction.goal.trim())
            throw new Error("Add a learning goal first.");
          if (
            s.jobs.some(
              (j) =>
                j.type === type &&
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
            ...(type !== "recommend" ? { paperId: id } : {}),
            status: "queued",
            createdAt: now,
            attempts: 0,
          });
          if (paper && type === "generate") {
            paper.generationStatus = "queued";
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
