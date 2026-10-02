import { z } from "zod";
import type { Source } from "./types";

export const assistantTargetSchema = z.object({ kind: z.enum(["paper", "subject"]), id: z.string().min(1).max(160).regex(/^[a-zA-Z0-9./-]+$/) });
export type AssistantTarget = z.infer<typeof assistantTargetSchema>;
export type AssistantSource = Source & { kind?: "paper" | "lesson" | "notecard"; sectionId?: string };
export type AssistantEvidence = {
  title: string; arxivId: string; lessonDigest?: string; digest: string;
  sources: AssistantSource[]; material: unknown; scope: string;
};
export type Conversation = { id: string; target: AssistantTarget; title: string; createdAt: string; updatedAt: string };
export type AssistantTurn = {
  id: string; conversationId: string; question: string; selection: string;
  status: "queued" | "running" | "complete" | "failed" | "cancelled";
  answer: string; createdAt: string; updatedAt: string; error?: string;
  evidenceDigest: string; lessonDigest?: string;
  sources: Omit<AssistantSource, "excerpt">[];
};
export type StoredAssistantTurn = AssistantTurn & { evidence: AssistantEvidence; leaseToken?: string; leaseUntil?: string };
export const conversationAskSchema = z.object({
  action: z.literal("ask"), id: z.string().uuid(), conversationId: z.string().min(1).max(200).regex(/^(?:[0-9a-f-]{36}|legacy-[a-zA-Z0-9./-]+)$/), target: assistantTargetSchema,
  question: z.string().trim().min(1).max(3000), selection: z.string().max(6000).default(""),
});
export type ConversationAsk = z.infer<typeof conversationAskSchema>;
export const isActiveTurn = (turn: {status: string}) => turn.status === "queued" || turn.status === "running";
export function publicTurn(turn: StoredAssistantTurn): AssistantTurn {
  const { evidence, leaseToken, leaseUntil, ...visible } = turn;
  return visible;
}
export const targetQuery = (target: AssistantTarget) => new URLSearchParams({ kind: target.kind, targetId: target.id });
