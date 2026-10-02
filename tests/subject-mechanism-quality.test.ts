import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import type { SubjectMechanism } from "../src/lib/subject-mechanism";
import { validateSubjectMechanismQuality } from "../src/lib/subject-mechanism-quality";
import { subjectMechanismSourceReviewSchema } from "../scripts/generate-subject-mechanisms";
import { requireCleanSubjectReview } from "../src/lib/subject-review";

function fixture(): SubjectMechanism {
  const refs = { sourceIds: ["source"], claimIds: ["claim"] };
  const ids = ["input", "operand", "compute", "result", "retain"];
  const relationships = ids.slice(1).map((id, i) => ({ id: `edge-${i}`, from: ids[i], to: id, label: "scientific dependency", dashed: false, ...refs }));
  return {
    version: 1, sectionId: "mechanism", title: "A symbolic computation", introduction: "Follow one named operand through a connected computation, preserving the identity of the input while producing a distinct result.",
    entities: [{ id: "x", label: "x", meaning: "The named input operand." }, { id: "y", label: "y", meaning: "The named computed result." }],
    objects: ids.map(id => ({ id, form: "module", label: id, detail: "A scientific role", ...refs })),
    relationships,
    beats: Array.from({ length: 3 }, (_, i) => ({ title: `Operation ${i + 1}`, explanation: "The named input supplies a connected operation, which produces the symbolic result while preserving the meaning of the stable input identity.", ...refs,
      objects: ids.map((id, j) => ({ objectId: id, status: "active" as const, entityIds: j < 2 ? ["x"] : i === 2 ? ["y"] : [] })),
      relationships: relationships.map(edge => ({ relationshipId: edge.id, entityIds: [] })),
    })),
    takeaway: "The operand remains identifiable while the connected computation produces a distinct result.", ...refs,
  };
}

test("meaningful module-contained computation passes ownership checks without a shape-based shortcut", () => {
  assert.doesNotThrow(() => validateSubjectMechanismQuality(fixture()));
});

test("unshown symbols and unexercised connections cannot pass semantic publication", () => {
  const symbols = fixture();
  symbols.entities.push({ id: "badge", label: "B", meaning: "An otherwise unused decorative identity." });
  assert.throws(() => validateSubjectMechanismQuality(symbols), /never appear in any state: badge/);
  const edge = fixture();
  edge.beats.forEach(beat => { beat.relationships = beat.relationships.filter(item => item.relationshipId !== "edge-1"); });
  assert.throws(() => validateSubjectMechanismQuality(edge), /never appear in any beat: edge-1/);
});

test("a visible alias cannot stand for two scientific identities", () => {
  const scene = fixture(); scene.entities[1].label = "x";
  assert.throws(() => validateSubjectMechanismQuality(scene), /share the visible alias/);
});

test("empty data shapes and separate dependency islands do not establish a mechanism", () => {
  const empty = fixture();
  empty.objects.forEach(object => { object.form = "bank"; });
  empty.beats.forEach((beat, i) => { beat.objects.forEach((object, j) => { object.entityIds = j === 0 ? [i === 2 ? "y" : "x"] : []; }); });
  assert.throws(() => validateSubjectMechanismQuality(empty), /at least two actual objects/);
  const islands = fixture();
  islands.relationships[2].from = "input"; islands.relationships[2].to = "compute";
  assert.throws(() => validateSubjectMechanismQuality(islands), /disconnected scientific dependency groups/);
});

test("existing reviewed sidecars satisfy the stronger semantic ownership policy", () => {
  const directory = new URL("../src/content/subjects/mechanisms/", import.meta.url);
  for (const file of readdirSync(directory).filter(file => file.endsWith(".json"))) {
    const scene = JSON.parse(readFileSync(new URL(file, directory), "utf8")) as SubjectMechanism;
    assert.doesNotThrow(() => validateSubjectMechanismQuality(scene), file);
  }
});

test("a source reviewer cannot omit ownership or suppress its actionable findings", () => {
  const passed = { passed: true, findings: [] };
  const oldReport = { science: passed, teaching: passed, states: passed };
  assert.equal(subjectMechanismSourceReviewSchema.safeParse(oldReport).success, false);
  const contradictory = subjectMechanismSourceReviewSchema.parse({ ...oldReport, ownership: { passed: true, findings: ["The displayed result alias belongs to a different object in beat 2."] } });
  assert.throws(() => requireCleanSubjectReview(contradictory), /ownership: The displayed result alias/);
  assert.doesNotThrow(() => requireCleanSubjectReview(subjectMechanismSourceReviewSchema.parse({ ...oldReport, ownership: passed })));
});
