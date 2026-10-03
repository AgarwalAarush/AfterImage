import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { targetCatalog } from "../worker/repair-controller";
import { sceneGraphSchema } from "../src/lib/scene";
import { illustrationSchema } from "../src/lib/scene-illustration";

const glyph = { id: "retain", glyph: "vector" as const, label: "Retained state", detail: "Preserve the indexed operand.", values: ["hₜ₋₁"] };
const illustration = {
 takeaway: "Retain the preceding state before updating it.",
 panels: [{ kind: "schematic" as const, title: "Retain history", caption: "Keep the indexed previous state.", illustrative: true, sourceIds: ["method"],
  nodes: [glyph, { id: "output", glyph: "module" as const, label: "Updated state", detail: "Receives retained history." }],
  edges: [{ from: "retain", to: "output", label: "retain", dashed: false }] }],
};
const componentSchema = z.object({ content: sceneGraphSchema });
const scene = { title: "Retained state", description: "Preserve the complete previous-state operand.", footnote: "An illustrative recurrence.", nodes: [], edges: [] };

for (const [state, value] of [["null", null], ["undefined", undefined], ["populated", illustration]] as const) {
 test(`component whole illustration cannot become a normal ${state} replacement target`, () => {
  const candidate = componentSchema.parse({ content: { ...scene, illustration: value } });
  const paths = targetCatalog(candidate, componentSchema).map(t => t.path);
  assert.ok(!paths.includes("/content/illustration"), "Whole component representation bypassed explicit replan");
  assert.ok(!paths.includes("/content/illustration/panels"), "Whole panel list bypassed explicit replan");
  assert.ok(paths.includes("/content/description"), "An unrelated legal native leaf was withheld");
 });
}

const nullablePanelsSchema = z.object({ content: z.object({ illustration: illustrationSchema.extend({ panels: illustrationSchema.shape.panels.nullish() }) }) });
for (const [state, value] of [["null", null], ["undefined", undefined], ["populated", illustration.panels]] as const) {
 test(`whole panel list remains reserved for replan when ${state}`, () => {
  const candidate = nullablePanelsSchema.parse({ content: { illustration: { takeaway: illustration.takeaway, panels: value } } });
  const paths = targetCatalog(candidate, nullablePanelsSchema).map(t => t.path);
  assert.ok(!paths.includes("/content/illustration"));
  assert.ok(!paths.includes("/content/illustration/panels"));
  assert.ok(paths.includes("/content/illustration/takeaway"));
 });
}

test("component representation guards retain precise panel leaves and native glyph owners", () => {
 const candidate = componentSchema.parse({ content: { ...scene, illustration } });
 const paths = targetCatalog(candidate, componentSchema).map(t => t.path);
 assert.ok(paths.includes("/content/illustration/panels/0/caption"));
 assert.ok(paths.includes("/content/illustration/panels/0/nodes/0"));
 assert.ok(paths.includes("/content/illustration/panels/0/nodes/0/values/0"));
 assert.ok(!paths.includes("/content/illustration/panels/0/kind"));
 assert.ok(!paths.includes("/content/illustration/panels/0/nodes/0/glyph"));
 assert.ok(!paths.includes("/content/illustration/panels/0"));
});
