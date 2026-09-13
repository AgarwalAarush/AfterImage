import test from "node:test";
import assert from "node:assert/strict";
import { parsePaperId } from "../src/lib/identity";
import { sceneSvg, validateScene } from "../src/lib/scene";
import { initialState } from "../src/lib/catalog";
const scene = {
  title: "Routing",
  description: "An input is routed to an expert.",
  footnote: "One selected path",
  nodes: [
    {
      id: "input",
      kind: "box",
      x: 60,
      y: 170,
      w: 150,
      h: 80,
      label: "<script>alert(1)</script>",
      detail: "Input data",
      emphasis: false,
    },
    {
      id: "expert",
      kind: "matrix",
      x: 500,
      y: 170,
      w: 150,
      h: 80,
      label: "Expert",
      detail: "Selected computation",
      emphasis: true,
    },
  ],
  edges: [{ from: "input", to: "expert", label: "route", dashed: true }],
};
test("canonical paper identity deduplicates versions and reader URLs", () => {
  for (const value of [
    "2401.04088v2",
    "https://arxiv.org/pdf/2401.04088v2.pdf",
    "https://www.alphaxiv.org/abs/2401.04088?chat=1",
  ])
    assert.equal(parsePaperId(value), "2401.04088");
  assert.equal(parsePaperId("https://arxiv.org/abs/cs/9901001"), "cs/9901001");
});
test("paper imports reject non-source hosts and malformed IDs", () => {
  for (const value of [
    "http://arxiv.org/abs/2401.04088",
    "https://arxiv.org.evil.com/abs/2401.04088",
    "file:///etc/passwd",
    "https://127.0.0.1/abs/2401.04088",
    "https://arxiv.org/abs/../../secret",
  ])
    assert.throws(() => parsePaperId(value));
});
test("diagram renders text safely as native SVG", () => {
  const svg = sceneSvg(scene);
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("<text"));
  assert.ok(svg.includes('viewBox="0 0 800 470"'));
});
test("diagram validation rejects collisions and dangling edges", () => {
  assert.throws(() =>
    validateScene({
      ...scene,
      nodes: [scene.nodes[0], { ...scene.nodes[1], x: 70 }],
    }),
  );
  assert.throws(() =>
    validateScene({
      ...scene,
      edges: [{ from: "missing", to: "expert", label: "", dashed: false }],
    }),
  );
  assert.throws(() =>
    validateScene({
      ...scene,
      nodes: [scene.nodes[0], { ...scene.nodes[1], x: 680 }],
    }),
  );
});
test("starter catalog never fabricates personal reading history", () => {
  const s = initialState();
  assert.equal(Object.keys(s.entries).length, 0);
  assert.equal(s.recommendationSource, "starter");
  assert.equal(s.direction.goal, "");
  assert.ok(s.papers.every((p) => p.recall?.provenance === "editorial"));
  s.papers[0].title = "changed";
  assert.notEqual(initialState().papers[0].title, "changed");
});
