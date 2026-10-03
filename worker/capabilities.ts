import { z } from "zod";
import { sceneGraphSchema, generationResultSchema } from "../src/lib/scene";
import { illustrationPanelSchema, validateIllustration } from "../src/lib/scene-illustration";
import type { MechanismPlan } from "./quality";

/** The full schema is shared; feature notes describe renderer semantics, not a second set of bounds. */
export const capabilities = {
  scene: z.toJSONSchema(sceneGraphSchema),
  features: {
    allocation: "groups.items contains ONLY assigned object identities. Padding is implicit: capacity minus items.length, rendered as empty dashed cells; never insert P/pad/empty placeholder identities. Native blockSize outlines nested illustrative slot blocks inside one expert region. Capacities must be divisible; null means independent slots. Keep physical block dimensions in cited captions. This primitive has no detached/crossed-out dropped-token objects: choose a padding comparison retaining all tokens, or a routing representation that explicitly keeps unassigned identities visible.",
    schematic: "A schematic must contain a data-bearing glyph. Its dependency graph is acyclic, with at most four dependency layers and two nodes in any layer; a controller with three parallel heads cannot use this primitive in one panel. Do not add a backward edge to the same forward diagram. Split dense policies into narrow source-supported proofs or use a flow graph when the objects are only compute modules. Token/bank identities are at most four characters; keep full names in the node label or caption.",
    routing: "Identities and assignments must fit the bounded arrays; do not silently remove objects to make an example fit.",
    text: "Short fields are labels/units, not sentences. Put complete extended explanations in captions. No source text is truncated by the renderer.",
    scope: "Use one narrow source-supported proof. No arbitrary coordinates, SVG, or invented grouping operations. sharedIdentities means individual transferred token/item identities, never expert/group labels; they must appear in every comparable panel. Drafting must preserve the preflighted assignments and group identities.",
  },
};
export const capabilityPrompt = "\nSHARED RENDERER CAPABILITIES AND SCHEMA (authoritative for planning, generation, review and repair):\n" + JSON.stringify(capabilities);
const examplePanel = z.discriminatedUnion("kind", illustrationPanelSchema.options);
export const exampleContractSchema = z.object({
  panels: z.array(examplePanel).min(1).max(3),
  sharedIdentities: z.array(z.string().min(1).max(18)).max(24),
}).nullish();
export type ExampleContract = z.infer<typeof exampleContractSchema>;

export function validateExampleContract(plan: MechanismPlan) {
  const example = plan.diagram.example;
  if (!example) {
    if (["allocation", "routing"].includes(plan.diagram.representation || "")) throw new Error("Allocation/routing planning requires a concrete bounded example before drafting.");
    return;
  }
  const panels = exampleContractSchema.unwrap().unwrap().parse(example).panels;
  validateIllustration({ takeaway: "Preflight of the proposed illustrative example.", panels });
  if (panels.some(panel => !panel.illustrative)) throw new Error("A planning example must be explicitly illustrative.");
  if (new Set(example.sharedIdentities).size !== example.sharedIdentities.length) throw new Error("Example identities must be unique.");
  if (panels.some(panel => ["allocation", "routing"].includes(panel.kind)) && !example.sharedIdentities.length)
    throw new Error("Allocation/routing comparisons require shared example identities.");
  for (const panel of panels) {
    const identities = panel.kind === "allocation" ? panel.groups.flatMap(group => group.items)
      : panel.kind === "routing" ? panel.left : undefined;
    if (identities && example.sharedIdentities.some(id => !identities.includes(id)))
      throw new Error("The selected representation cannot preserve every shared example identity.");
  }
}

export function candidateExampleDefects(candidate: z.infer<typeof generationResultSchema>, example: ExampleContract): string[] {
  if (!example?.sharedIdentities.length) return [];
  const panels = candidate.scene.illustration?.panels || [];
  const errors: string[] = [];
  if (example.panels.some(panel => ["allocation", "routing"].includes(panel.kind)) &&
    (panels.length !== example.panels.length || panels.some((panel, i) => panel.kind !== example.panels[i]?.kind)))
    errors.push("The draft changes the preflighted comparison representation. Preserve its panels or explicitly replan.");
  for (const [i, panel] of panels.entries()) {
    const ids = panel.kind === "allocation" ? panel.groups.flatMap(group => group.items) : panel.kind === "routing" ? panel.left : undefined;
    if (ids && example.sharedIdentities.some(id => !ids.includes(id))) errors.push(`Panel ${i + 1} drops a declared shared example identity.`);
    const proposed = example.panels[i];
    if (panel.kind === "allocation" && proposed?.kind === "allocation") {
      const assignments = (p: typeof panel) => p.groups.map(group => [group.label, [...group.items].sort()]);
      if (JSON.stringify(assignments(panel)) !== JSON.stringify(assignments(proposed))) errors.push(`Panel ${i + 1} changes the preflighted expert assignments. Preserve them or explicitly replan the example.`);
    }
    if (panel.kind === "routing" && proposed?.kind === "routing") {
      const assignments = (p: typeof panel) => p.links.map(link => `${p.left[link.left]}→${p.right[link.right]}`).sort();
      if (JSON.stringify(assignments(panel)) !== JSON.stringify(assignments(proposed))) errors.push(`Panel ${i + 1} changes the preflighted routing assignments. Preserve them or explicitly replan the example.`);
    }
  }
  return errors;
}
