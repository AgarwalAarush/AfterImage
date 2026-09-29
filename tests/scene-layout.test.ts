import test from "node:test";
import assert from "node:assert/strict";
import { prepareScene, sceneSvg, sceneSvgMobile, sceneGraphSchema, resultSchema, validateScene } from "../src/lib/scene";
import { layoutScene } from "../src/lib/scene-layout";
import { inspectSvg } from "../worker/diagram-review";
import { outputSchema } from "../worker/output-schema";
import { sglangScene } from "./fixtures/sglang-scene";

test("SGLang regression: preserve the complete graph without connector/text collisions", () => {
  assert.ok(inspectSvg(sceneSvg(sglangScene)).some(issue => issue.includes("Connector crosses text")));
  const scene = prepareScene(sglangScene);
  assert.deepEqual(scene.edges, sglangScene.edges);
  for (const mobile of [false, true]) {
    const svg = (mobile ? sceneSvgMobile : sceneSvg)(scene);
    assert.deepEqual(inspectSvg(svg), []);
    assert.match(svg, /insert path \+ KV refs/);
    assert.match(svg, /remove leaf/);
    const layout = layoutScene(scene, mobile);
    assert.equal(layout.edges.length, scene.edges.length);
    for (const edge of layout.edges) {
      for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1], b = edge.points[i];
        assert.ok(a.x === b.x || a.y === b.y);
        // Actual strokes must avoid every node interior, not just its text.
        for (const n of layout.nodes) {
          const crosses = a.x === b.x
            ? a.x > n.x && a.x < n.x + n.w && Math.max(a.y, b.y) > n.y && Math.min(a.y, b.y) < n.y + n.h
            : a.y > n.y && a.y < n.y + n.h && Math.max(a.x, b.x) > n.x && Math.min(a.x, b.x) < n.x + n.w;
          assert.equal(crosses, false, `${edge.from} → ${edge.to} intersects ${n.id}`);
        }
      }
    }
    assert.equal(svg, (mobile ? sceneSvgMobile : sceneSvg)(scene));
  }
});

test("generation schema requests semantic nodes, while stored scenes preserve the renderer version", () => {
  const schema = outputSchema(sceneGraphSchema) as any;
  assert.equal(schema.properties.nodes.items.properties.x, undefined);
  const scene = prepareScene(sglangScene);
  assert.equal(resultSchema.shape.scene.parse(scene).layout, "flow-v2");
  assert.throws(() => validateScene(prepareScene({ ...sglangScene, edges: [{ from: "missing", to: "tree", label: "", dashed: false }] })));
});

test("review catches an arrow through an unrelated node even if it misses all text", () => {
  const svg = `<svg viewBox="0 0 400 200"><g data-concept="other" data-node-bounds="100,60,180,100"><rect x="100" y="60" width="180" height="100"/></g><path data-connector="true" data-from="source" data-to="target" d="M20 100L380 100"/></svg>`;
  assert.deepEqual(inspectSvg(svg), ["Connector crosses node: other"]);
});

test("bounded graphs retain branching, merges, disconnected nodes and long labels", () => {
  const cases = [
    [[0,1],[0,2],[1,3],[2,3]],
    [[0,1],[1,2],[2,0],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[6,1]],
    [[0,4],[1,4],[2,4],[3,4],[4,5],[4,6],[4,7]],
    [],
  ];
  for (const pairs of cases) {
    const scene = prepareScene({ title: "A graph with long identifiers and several independent paths", description: "A routing regression fixture", footnote: "Only the listed connections are drawn.",
      nodes: Array.from({ length: 8 }, (_, i) => ({ id: `node-${i}`, kind: ["circle", "box", "matrix", "stack", "experts"][i % 5], label: "abcdefghijklmnopqrstuvwxyz", detail: "abcdefghijklmnopqrstuvwxyzabcdef", emphasis: i % 2 === 0 })),
      edges: pairs.map(([a,b]) => ({ from: `node-${a}`, to: `node-${b}`, label: "a labeled relationship", dashed: a === 2 })),
    });
    for (const render of [sceneSvg, sceneSvgMobile]) assert.deepEqual(inspectSvg(render(scene)), []);
  }
});

test("dense directed graphs route without losing edges or sharing a connector segment", () => {
  let seed = 231207104;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let sample = 0; sample < 16; sample++) {
    const pairs = new Set<string>();
    while (pairs.size < 10) {
      const a = Math.floor(random() * 8), b = Math.floor(random() * 8);
      if (a !== b) pairs.add(`${a},${b}`);
    }
    const scene = prepareScene({ title: "Dense directed graph", description: "All edges are retained", footnote: "Arrows indicate direction.",
      nodes: Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, kind: "box", label: `Node ${i}`, detail: "A complete bounded node", emphasis: false })),
      edges: [...pairs].map(pair => { const [a,b] = pair.split(","); return { from: `n${a}`, to: `n${b}`, label: "", dashed: false }; }),
    });
    for (const mobile of [false, true]) {
      const layout = layoutScene(scene, mobile), segments = new Set<string>();
      assert.equal(layout.edges.length, 10);
      for (const edge of layout.edges) for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1], b = edge.points[i];
        const count = (Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / 10;
        for (let step = 0; step < count; step++) {
          const at = (s: number) => `${a.x + s * 10 * Math.sign(b.x - a.x)},${a.y + s * 10 * Math.sign(b.y - a.y)}`;
          const segment = [at(step), at(step + 1)].sort().join("|");
          assert.equal(segments.has(segment), false, `overlapping segment ${segment}`);
          segments.add(segment);
        }
      }
    }
  }
});
