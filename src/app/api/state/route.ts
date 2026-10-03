import { ensurePreferences, recordChoice, recordEngagement, undoFeedback } from "@/lib/preferences";
import { NextResponse } from "next/server";
import { authenticated, sameOrigin } from "@/lib/auth";
import { mutate, publicState, snapshot, stateStatus } from "@/lib/store";
import { parsePaperId } from "@/lib/identity";
import { importPaper } from "@/lib/papers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Paper } from "@/lib/types";
import { advanceRecommendations, queueRecommendationRefill } from "@/lib/recommendations";
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
      const profile = ensurePreferences(s);
      let feedbackUndone: boolean | undefined;
      const eventId = body.eventId ? z.string().uuid().parse(body.eventId) : randomUUID();
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
        queueRecommendationRefill(s, now, randomUUID);
      };
      if (body.action === "engagement") {
        const input = z.object({eventId: z.string().uuid(), paperId: z.string().max(40),
          seconds: z.number().min(45).max(86400), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).parse(body);
        const recorded = recordEngagement(s,input.eventId,input.paperId,input.seconds,input.day,now);
        return {ok: true, recorded};
      }
      switch (body.action) {
        case "learning-policy": {
          const enabled = z.boolean().parse(body.enabled);
          if (profile.enabled !== enabled) {profile.enabled = enabled;profile.revision++;refreshFromReading();}
          break;
        }
        case "interests": {
          const update = z.object({learningFromReading: z.boolean(), interests: z.array(z.object({
            id: z.string().min(1).max(60), strength: z.enum(["stronger","normal","less","off"]),
          })).max(12)}).parse(body);
          let changed = profile.learningFromReading !== update.learningFromReading;
          if (new Set(update.interests.map(i => i.id)).size !== update.interests.length) throw new Error("Duplicate interest");
          for (const interest of update.interests) {
            const existing = profile.interests.find(i => i.id === interest.id);
            if (!existing) throw new Error("Unknown interest");
            changed ||= existing.strength !== interest.strength;
            existing.strength = interest.strength;
          }
          profile.learningFromReading = update.learningFromReading;
          if (changed) {profile.revision++;refreshFromReading();}
          break;
        }
        case "undo-feedback":
          feedbackUndone = undoFeedback(s,z.string().uuid().parse(body.eventId),now);
          if (feedbackUndone) refreshFromReading();
          break;
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
          break;
        case "status":
          const status = z.enum(["saved", "reading", "read", "archived"]).parse(body.status);
          Object.assign(ensureEntry(), {
            status,
            updatedAt: now,
          });
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
          profile.revision++;
          refreshFromReading();
          break;
        case "feedback": {
          const value = z
            .enum(["useful", "known", "advanced", "irrelevant", "later"])
            .parse(body.value);
          if (!paper) throw new Error("Paper not found");
          const previous = s.feedback.find(f => f.eventId === eventId);
          if (previous && (previous.paperId !== id || previous.value !== value)) throw new Error("Feedback action already used");
          if (!previous) {
            s.feedback.push({ paperId: id, value, at: now, eventId, profileRevision: profile.revision });
            recordChoice(s,{id: eventId,paperId: id,kind: "feedback",value,at: now,recommendation: s.recommendations.find(r => r.paperId === id)});
          }
          refreshFromReading();
          if (value === "later") ensureEntry();
          break;
        }
        case "study":
        case "generate":
        case "recommend": {
          const type = z.enum(["generate", "recommend", "study"]).parse(body.action);
          if (type !== "recommend" && !paper) throw new Error("Paper not found");
          if (type !== "recommend") ensureEntry();
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
            delete paper.generationStep;
            delete paper.generationError;
          }
          s.jobs = s.jobs.slice(-100);
          break;
        }
        default:
          throw new Error("Unknown action");
      }
      if (["import","generate","study"].includes(body.action)) recordChoice(s,{id: eventId,paperId: id,kind: "prepare",at: now});
      if (body.action === "save") recordChoice(s,{id: eventId,paperId: id,kind: body.status === "reading" ? "reading" : "save",at: now});
      if (body.action === "status" && ["reading","read"].includes(body.status)) recordChoice(s,{id: eventId,paperId: id,kind: "reading",at: now});
      advanceRecommendations(s, now, randomUUID);
      return { state: publicState(s), paperId: id, ...(feedbackUndone === undefined ? {} : {feedbackUndone}) };
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
