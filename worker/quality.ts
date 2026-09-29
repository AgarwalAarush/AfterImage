import { z } from "zod";
import type { Recall, Source } from "../src/lib/types";

export const qualityVersion = "mechanism-first-v2";
export type RepairTarget = "scene" | "recall" | "both";
/** Preserve unrelated accepted content when one part of a review fails. */
export function technicalRepairTarget(defects: string[]): RepairTarget {
  const diagram = defects.some(d => d.startsWith("diagram:"));
  const recall = defects.some(d => !d.startsWith("diagram:"));
  return diagram && recall ? "both" : diagram ? "scene" : "recall";
}
const explanation = z.string().min(1).max(1800);
const citations = z.array(z.string()).min(1).max(8);
export const mechanismPlanSchema = z.object({
  contribution: explanation,
  baseline: explanation,
  evidenceScope: z.enum(["abstract", "full-text"]),
  steps: z.array(z.object({
    phase: z.enum(["training", "inference", "analysis", "experiment", "other"]),
    input: explanation,
    operation: explanation,
    output: explanation,
    purpose: explanation,
    sourceIds: citations,
  })).min(1).max(8),
  criticalDistinctions: z.array(explanation).min(1).max(6),
  math: z.object({ essential: z.boolean(), reason: explanation, computations: z.array(explanation).max(5) }),
  walkthrough: z.object({ essential: z.boolean(), reason: explanation }),
  diagram: z.object({ focus: explanation, transferredObjects: explanation, omitted: explanation }),
  unknowns: z.array(explanation).max(8),
});
export type MechanismPlan = z.infer<typeof mechanismPlanSchema>;
const check = z.object({
  verdict: z.enum(["pass", "fail", "not-applicable"]),
  evidence: explanation,
  sourceIds: z.array(z.string()).max(8),
  repair: z.string().max(1800),
});
export const technicalReviewSchema = z.object({
  contribution: check,
  computation: check,
  phases: check,
  notation: check,
  example: check,
  diagram: check,
  evidence: check,
  scope: check,
});
export type TechnicalReview = z.infer<typeof technicalReviewSchema>;

export const planningPrompt = `Before writing a notecard, reconstruct what this paper actually does from SOURCE DATA. Return a concise mechanism plan (aim for 600 words), not a finished summary or drawing. Avoid repeated statements. Identify the baseline and precise contribution; ordered inputs, operations, outputs, and purposes; training versus inference or other relevant phases; the distinctions a reader must not confuse; and unknowns that the sources do not resolve. Every step must cite supplied sourceIds that actually support it. Specify whether math and a worked walkthrough are essential to understanding THIS contribution, and why. Do not require equations for a qualitative paper. For abstract-only material, never invent internal computations: plan only the supported high-level explanation and explicitly list missing methods. Select one coherent diagram focus narrow enough for 2-8 nodes; do not demand that one picture cover every planned step. describe the objects its connections carry, and disclose what the picture omits. The plan is provisional and will be checked against the sources independently.`;

export const technicalReviewPrompt = `You are a technical teaching reviewer in a fresh pass. Audit RESULT against SOURCE DATA independently; PLAN is a proposed coverage checklist, not trusted evidence. Complete EVERY check with pass, fail, or justified not-applicable. Evidence must identify a specific result passage or omission and relevant source support. Any failure needs an actionable repair. Do not reward length or mathematical decoration.
contribution: Does the reader learn what changed from the baseline, rather than background alone?
computation: Can the reader trace the central mechanism's inputs -> actual operation -> outputs, and explain why each step exists? Naming stages or saying "process/fuse/update" without explaining what changes fails.
phases: Are training/inference, learned/frozen components, and sequential/parallel operations distinguished wherever relevant?
notation: Do equations cover the paper-specific computation where essential, with correct symbols, dimensions, indexing, scaling and purpose? Is explanatory shorthand distinguished from a source equation? A glossary plus a background equation fails when it omits the contribution.
example: Where needed, can a reader follow a concrete token/tensor/numerical trace from input to output? Invented numbers must be labeled illustrative and work arithmetically. Tables must explain operations, not repeat labels.
diagram: Does this picture explain its declared focus, with identifiable transferred objects and truthful arrows? Is a simplified branch labeled as such? A visually clean sequence of vague boxes fails. Transferred objects may be identified by node text, nearby details, or captions; arrow labels are not mandatory and can cause clutter. Judge the declared focus, not every object in PLAN. A worked table can supply detailed assignments while a diagram explains their causal relationship. Do not require a single diagram to show the whole paper.
evidence: Are reported outcomes tied to conditions and a baseline? Explain important table metrics and denominators; do not equate acceptance length with speedup or extrapolate a maximum to every setting.
scope: Do citations support the claims and does the explanation honestly disclose unknowns/source limits? No invented evidence or unsupported details, especially with abstract-only sources.
Contribution, computation, diagram, evidence, and scope cannot be not-applicable: assess their adequacy for the available source scope. Other checks can be not-applicable only with a concrete reason. A source-grounded plan marking math/walkthrough essential requires those checks to pass. If the plan itself is wrong, flag it explicitly; do not force an incorrect plan into RESULT.`;

export function validateMechanismPlan(plan: MechanismPlan, sources: Source[], scope: "abstract" | "full-text") {
  if (plan.evidenceScope !== scope) throw new Error("Plan misstates source scope");
  const ids = new Set(sources.map(s => s.id));
  if (plan.steps.some(step => step.sourceIds.some(id => !ids.has(id)))) throw new Error("Plan cites an unknown source");
  if (plan.math.essential && !plan.math.computations.length) throw new Error("Plan requires math without naming the computations");
  if (scope === "abstract" && !plan.unknowns.length) throw new Error("Abstract-only plan must disclose missing method evidence");
}

/** A review cannot silently approve omitted checks or waive required mechanism coverage. */
export function technicalDefects(plan: MechanismPlan, recall: Pick<Recall, "equations" | "walkthrough">, review: TechnicalReview, sources: Source[]): string[] {
  const parsed = technicalReviewSchema.parse(review);
  const ids = new Set(sources.map(s => s.id));
  const failures: string[] = [];
  const required = new Set(["contribution", "computation", "diagram", "evidence", "scope"]);
  if (plan.math.essential) required.add("notation");
  if (plan.walkthrough.essential) required.add("example");
  const phases = new Set(plan.steps.map(step => step.phase));
  if (phases.has("training") && phases.has("inference")) required.add("phases");
  for (const [name, check] of Object.entries(parsed)) {
    if (check.sourceIds.some(id => !ids.has(id))) failures.push(`${name}: unknown review citation`);
    if (check.verdict === "fail") failures.push(`${name}: ${check.evidence} Repair: ${check.repair || "Provide a source-grounded correction."}`);
    if (check.verdict === "not-applicable" && required.has(name)) failures.push(`${name}: required coverage cannot be waived. ${check.evidence}`);
    if (check.verdict === "pass" && ["contribution", "computation", "evidence"].includes(name) && !check.sourceIds.length) failures.push(`${name}: pass lacks source support`);
  }
  if (plan.math.essential && !recall.equations?.length) failures.push("Missing equations for the planned core computations");
  if (plan.walkthrough.essential && !recall.walkthrough && !recall.equations?.some(eq => eq.example?.trim())) failures.push("Missing the required worked walkthrough or equation example");
  for (const [i, eq] of (recall.equations || []).entries()) {
    if (!eq.title?.trim()) failures.push(`Equation ${i + 1}: missing a descriptive title`);
  }
  return failures;
}
