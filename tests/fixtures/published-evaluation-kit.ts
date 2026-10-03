import { initialState } from "../../src/lib/catalog";
import { digest, publishKitComponent, type ComponentPublication } from "../../src/lib/kit-publication";
import { paperKit } from "../../src/lib/kit";
import type { Job, Paper } from "../../src/lib/types";

const now = "2026-10-02T12:00:00.000Z";
export function publishEvaluationComponent(paper: Paper, job: Job, id: string, content: unknown, dependencies?: Record<string, string>) {
 const sources = paper.sources.slice(0, 1);
 const publication: ComponentPublication = { id, completionId: digest([id, content, dependencies]), expectedRevision: paperKit(paper).components.find(c => c.id === id)?.revision ?? null,
  dependencies: dependencies ?? (id === "explanation" ? {} : { explanation: paperKit(paper).components.find(c => c.id === "explanation")!.revision! }),
  sources, scope: "full-text", content, review: { version: 1, contentDigest: digest(content), sourcesDigest: digest(sources), implementationDigest: "a".repeat(64), gates: { source: true, math: true, teaching: true, geometry: true, visual: true, quiz: true } } };
 return publishKitComponent(paper, job, publication, "fixture-lease", now);
}
export function publishedEvaluationKit() {
 const paper = initialState().papers[0]; paper.recall = null; paper.scene = null; paper.visual = undefined; paper.study = undefined; paper.kit = undefined;
 const sourceId = paper.sources[0].id;
 const job: Job = { id: "aggregate-fixture", paperId: paper.id, type: "generate", status: "running", attempts: 1, createdAt: now, leaseToken: "fixture-lease", leaseUntil: "2026-10-02T13:00:00.000Z" };
 const explanation = { version: 2, idea: "A source-grounded explanation.", problem: "The motivating problem.", mechanism: "A complete account of the described method.", evidence: "An explicitly bounded result.", limitation: "A limitation remains.", significance: "Why the method matters.", equations: [], sourceIds: [sourceId] };
 const quiz = [0, 1].map(i => ({ id: `q${i}`, question: "Which statement matches the described method?", options: ["Correct", "Different", "Neither"].map(text => ({ text, explanation: "This option is explained using the described method." })), answer: 0, sourceId }));
 const diagram = { title: "A bounded method", description: "An illustrative dependency connects the input to the result.", footnote: "An illustrative dependency.", illustration: null,
  nodes: [{ id: "input", kind: "box", label: "Input", detail: "Given input.", emphasis: false }, { id: "result", kind: "box", label: "Result", detail: "Derived result.", emphasis: true }],
  edges: [{ from: "input", to: "result", label: "derive", dashed: false }] };
 publishEvaluationComponent(paper, job, "explanation", explanation);
 publishEvaluationComponent(paper, job, "diagram", diagram);
 publishEvaluationComponent(paper, job, "quiz", quiz);
 return { paper, job, explanation, quiz, diagram };
}
