import { z } from "zod";
import { generationResultSchema, resultSchema, sceneGraphSchema } from "../src/lib/scene";
import { illustrationPanelSchema, illustrationSchema } from "../src/lib/scene-illustration";

/** Prevent invented citation identifiers at the model-output boundary. */
export function generationSchemas(sourceIds: string[]) {
  if (!sourceIds.length) throw new Error("Generation requires at least one source.");
  const citation = z.enum(sourceIds as [string, ...string[]]);
  const base = resultSchema.shape.recall;
  const recall = base.extend({
    sourceIds: z.array(citation).min(1).max(14),
    equations: z.array(base.shape.equations.element.extend({ sourceId: citation })).max(5),
    walkthrough: base.shape.walkthrough.unwrap().unwrap().extend({ sourceId: citation }).nullish(),
  });
  const [matrix, routing, bars, schematic, allocation, memory, tree, stateTrace] = illustrationPanelSchema.options;
  const support = { sourceIds: z.array(citation).min(1).max(8) };
  const illustration = illustrationSchema.extend({ panels: z.array(z.discriminatedUnion("kind", [matrix.extend(support), routing.omit({ layout: true }).extend(support), bars.extend(support), schematic.extend(support), allocation.extend(support), memory.extend(support), tree.extend(support), stateTrace.extend(support)])).min(1).max(3) });
  const scene = sceneGraphSchema.extend({ illustration: illustration.nullish() });
  return { recall, scene, result: generationResultSchema.extend({ recall, scene }) };
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

/** Caption-only defects should rewrite text, not regenerate a valid illustration. */
export function panelTextRepairSchema(panelCount: number) {
  if (panelCount < 1 || panelCount > 3) throw new Error("Caption repair requires bounded illustration panels.");
  return z.object({
    description: sceneGraphSchema.shape.description.describe("A complete, concise accessible description; at most 400 characters, preferably under 340. Never truncate."),
    captions: z.array(illustrationPanelSchema.options[0].shape.caption).length(panelCount),
  });
}
