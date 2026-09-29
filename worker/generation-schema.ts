import { z } from "zod";
import { generationResultSchema, resultSchema } from "../src/lib/scene";

/** Prevent invented citation identifiers at the model-output boundary. */
export function generationSchemas(sourceIds: string[]) {
  if (!sourceIds.length) throw new Error("Generation requires at least one source.");
  const citation = z.enum(sourceIds as [string, ...string[]]);
  const base = resultSchema.shape.recall;
  const recall = base.extend({
    sourceIds: z.array(citation).min(1).max(8),
    equations: z.array(base.shape.equations.element.extend({ sourceId: citation })).max(5),
    walkthrough: base.shape.walkthrough.unwrap().unwrap().extend({ sourceId: citation }).nullish(),
  });
  return { recall, result: generationResultSchema.extend({ recall }) };
}

export type RecallField = keyof typeof resultSchema.shape.recall.shape;
const fieldsByCheck: Record<string, RecallField[]> = {
  contribution: ["idea", "problem", "mechanism", "significance"],
  computation: ["mechanism", "equations", "walkthrough"],
  phases: ["mechanism", "equations", "walkthrough", "limitation"],
  notation: ["mechanism", "equations", "walkthrough"],
  example: ["equations", "walkthrough"],
  evidence: ["evidence"],
  // Scope or unclassified failures may refer to claims anywhere in the recall.
};
export function recallRepairFields(defects: string[]): RecallField[] | undefined {
  const fields = new Set<RecallField>();
  for (const defect of defects) {
    const check = defect.split(":", 1)[0];
    if (check === "diagram") continue;
    const affected = fieldsByCheck[check];
    if (!affected) return undefined;
    affected.forEach(field => fields.add(field));
  }
  return fields.size ? [...fields] : undefined;
}
