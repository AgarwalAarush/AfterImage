/** Pure aggregation for private, nonpublishing evaluation reports. */
import { kitSchema, paperKit, visibleComponent, type Kit } from "../src/lib/kit";
import type { Paper } from "../src/lib/types";
export type EvaluationOutcome = { id: string; status: string; [key: string]: unknown };
export type EvaluationResult = { paper: { id: string; [key: string]: unknown }; outcomes: EvaluationOutcome[]; failure?: unknown; initialFailure?: unknown; [key: string]: unknown };

function evaluationKit(paper: EvaluationResult["paper"]): Kit | undefined {
 try {
  // Legacy reviewed content has the same adapter as the reader, without a migration.
  if (paper.kit === undefined && !Array.isArray(paper.sources)) return;
  const parsed = kitSchema.safeParse(paper.kit === undefined ? paperKit(paper as unknown as Paper) : paper.kit);
  if (!parsed.success || new Set(parsed.data.components.map(c => c.id)).size !== parsed.data.components.length) return;
  return parsed.data;
 } catch { return; }
}
function hasComponentContent(paper: EvaluationResult["paper"], id: string): boolean {
 const value = paper as unknown as Partial<Paper>;
 if (id === "explanation") return !!value.recall && typeof value.recall === "object";
 if (id === "diagram") return !!value.scene && typeof value.scene === "object" || typeof value.visual === "string" && !!value.visual;
 if (id === "quiz") return Array.isArray(value.study?.quiz) && value.study.quiz.length > 0;
 return id.startsWith("figure:") && Array.isArray(value.study?.figures) && value.study.figures.some(figure => figure?.id === id.slice(7));
}
function currentComponent(paper: EvaluationResult["paper"], kit: Kit, id: string, visiting = new Set<string>()): boolean {
 const component = kit.components.find(c => c.id === id);
 if (!component || visiting.has(id) || !visibleComponent(kit, id) || !hasComponentContent(paper, id)) return false;
 // Match publication ownership; a dependent cannot be independent of its explanation.
 if (id === "explanation" ? Object.keys(component.dependencies).length > 0 : !component.dependencies.explanation) return false;
 visiting.add(id);
 const complete = Object.keys(component.dependencies).every(dependency => currentComponent(paper, kit, dependency, visiting));
 visiting.delete(id); return complete;
}
export function reconcileEvaluationOutcomes(result: EvaluationResult): EvaluationResult {
 const kit = evaluationKit(result.paper);
 return { ...result, outcomes: result.outcomes.map(outcome => outcome.status === "passed" && (!kit || !currentComponent(result.paper, kit, outcome.id)) ? { ...outcome, status: "withheld" } : outcome) };
}

export function mergeComponentRetry(result: EvaluationResult, target: string, next: EvaluationResult | null, code: number | null, originalNonPassedIds: readonly string[]): EvaluationResult {
 // An uncertain/partial retry cannot replace previously approved component progress.
 if (code !== 0 || !originalNonPassedIds.includes(target) || !next || next.failure
  || !next.paper || next.paper.id !== result.paper.id || !Array.isArray(next.outcomes) || next.outcomes.length !== 1
  || next.outcomes[0]?.id !== target || next.outcomes[0]?.status !== "passed"
  || result.outcomes.filter(outcome => outcome.id === target).length !== 1) return result;
 const aggregate = reconcileEvaluationOutcomes({ ...result, paper: next.paper, outcomes: result.outcomes.map(outcome => outcome.id === target ? next.outcomes[0] : outcome) });
 // Clear only the superseded aggregate error. Private initial and attempt diagnostics remain available.
 if (originalNonPassedIds.length && aggregate.outcomes.every(outcome => outcome.status === "passed")
  && originalNonPassedIds.every(id => aggregate.outcomes.some(outcome => outcome.id === id && outcome.status === "passed"))) delete aggregate.failure;
 return aggregate;
}
export function completeEvaluationResult(result: EvaluationResult | null | undefined): boolean {
 return !!result && !result.failure && Array.isArray(result.outcomes) && result.outcomes.length > 0 && reconcileEvaluationOutcomes(result).outcomes.every(outcome => outcome?.status === "passed");
}
