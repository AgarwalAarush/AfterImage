import test from "node:test";
import assert from "node:assert/strict";
import { validateRecall } from "../src/lib/recall-validation";
import { inspectSvg } from "../worker/diagram-review";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { LoraDiagram } from "../src/components/lora-diagram";
import { EagleDiagram } from "../src/components/eagle-diagram";
import { outputSchema } from "../worker/output-schema";
import { resultSchema } from "../src/lib/scene";
import { diagramText, sceneSvg, sceneSvgMobile } from "../src/lib/scene";
const recall = {
  idea: "A low-rank update",
  problem: "Adapt a model",
  mechanism: "Apply $A$ then $B$.",
  evidence: "Reported results",
  limitation: "Limited settings",
  sourceIds: ["page-1"],
  equations: [
    {
      latex: "h=W_0x+\\frac{\\alpha}{r}BAx",
      explanation: "Scaled update",
      sourceId: "page-1",
    },
  ],
};
const sources = [
  {
    id: "page-1",
    url: "https://arxiv.org/pdf/2106.09685#page=1",
    label: "Page 1",
    excerpt: "Evidence",
  },
];
test("scientific subscripts use supported SVG text and retain escaping", () => {
  const text = diagramText("W₀x + Bₜx < output");
  assert.ok(text.includes('font-size="70%">0</tspan>'));
  assert.ok(text.includes('font-size="70%">t</tspan>'));
  assert.ok(text.includes("&lt; output"));
  assert.ok(!text.includes("ₜ"));
});
test("converging connections use distinct target ports", () => {
  const node = (id: string, x: number, y: number) => ({
    id,
    x,
    y,
    w: 150,
    h: 80,
    kind: "box",
    label: id,
    detail: "",
    emphasis: false,
  });
  const svg = sceneSvg({
    title: "Two operands",
    description: "Two inputs feed one operation",
    footnote: "Both inputs are required",
    nodes: [node("a", 50, 80), node("b", 50, 290), node("sum", 500, 170)],
    edges: [
      { from: "a", to: "sum", label: "", dashed: false },
      { from: "b", to: "sum", label: "", dashed: false },
    ],
  });
  const paths = [...svg.matchAll(/data-connector="true" d="([^"]+)"/g)].map(
    (m) => m[1].split(",").at(-1),
  );
  assert.equal(new Set(paths).size, 2);
});
test("equations must render and cite an available source", () => {
  assert.doesNotThrow(() => validateRecall(recall, sources));
  assert.throws(() =>
    validateRecall(
      {
        ...recall,
        equations: [{ ...recall.equations[0], sourceId: "made-up" }],
      },
      sources,
    ),
  );
  assert.throws(() =>
    validateRecall(
      {
        ...recall,
        equations: [{ ...recall.equations[0], latex: "\\frac{a}{" }],
      },
      sources,
    ),
  );
  assert.throws(() =>
    validateRecall(
      {
        ...recall,
        equations: [
          { ...recall.equations[0], latex: "\\href{https://evil.test}{x}" },
        ],
      },
      sources,
    ),
  );
});
test("outline-based critic catches the reported connector-label defect", () => {
  const svg = (y: number) =>
    `<svg viewBox="0 0 200 100"><text x="100" y="50" text-anchor="middle" font-family="Overused Grotesk" font-size="20">Output</text><path data-connector="true" d="M0 ${y}H200"/></svg>`;
  assert.ok(
    inspectSvg(svg(44)).some((s) => s.includes("Connector crosses text")),
  );
  assert.deepEqual(inspectSvg(svg(75)), []);
});
test("LoRA authored diagram retains A then B and a separate output label", () => {
  const svg = renderToStaticMarkup(createElement(LoraDiagram));
  assert.ok(svg.indexOf(">A</text>") < svg.indexOf(">B</text>"));
  assert.ok(svg.includes("M380 109H455"));
  assert.ok(svg.includes("M725 194H820"));
  assert.ok(svg.includes('x="820" y="165"'));
  assert.ok(svg.includes("graphic-mobile"));
});

test("portrait canvas stays close to its rendered content",()=>{
 const node=(id:string,x:number)=>({id,x,y:160,w:150,h:80,kind:"box",label:id,detail:"A useful detail",emphasis:false});
 const svg=sceneSvgMobile({title:"A short sequence",description:"A then B",footnote:"A compact conclusion",nodes:[node("a",50),node("b",500)],edges:[{from:"a",to:"b",label:"",dashed:false}]});
 const height=Number(svg.match(/viewBox="0 0 380 (\d+)"/)![1]);
 assert.equal(height,495);
});

test("worked examples and walkthroughs cannot bypass math or source validation", () => {
  assert.throws(() => validateRecall({ ...recall, equations: [{ ...recall.equations[0], example: "$\\href{https://evil.test}{x}$" }] }, sources));
  const walkthrough = { title: "Trace", introduction: "An example", steps: [{label: "Step", input: "$x$", operation: "Project", output: "$y$"}], sourceId: "page-1" };
  assert.doesNotThrow(() => validateRecall({ ...recall, walkthrough }, sources));
  assert.throws(() => validateRecall({ ...recall, walkthrough: { ...walkthrough, sourceId: "invented" } }, sources));
  assert.throws(() => validateRecall({ ...recall, walkthrough: { ...walkthrough, steps: [{ ...walkthrough.steps[0], output: "$\\frac{broken$" }] } }, sources));
});

test("EAGLE teaching diagram has readable, non-colliding desktop and mobile labels", () => {
  const markup = renderToStaticMarkup(createElement(EagleDiagram));
  const svgs = markup.match(/<svg[\s\S]*?<\/svg>/g)!;
  assert.equal(svgs.length, 3);
  for (const svg of svgs) {
    assert.deepEqual(inspectSvg(svg), []);
    assert.match(svg, /TARGET VERIF/);
    assert.match(svg, /TRAINING-TIME TEST/);
    assert.match(svg, /baseline-shift="sub"/);
  }
});

test("Codex output schema requires nullable additions without breaking old recalls", () => {
  const schema = outputSchema(resultSchema) as any;
  const fields = schema.properties.recall;
  assert.ok(fields.required.includes("walkthrough"));
  const equation = fields.properties.equations.items;
  assert.ok(equation.required.includes("title"));
  assert.ok(equation.required.includes("example"));
  const equationSchema = resultSchema.shape.recall.shape.equations.element;
  assert.doesNotThrow(() => equationSchema.parse(recall.equations[0]));
  assert.doesNotThrow(() => equationSchema.parse({ ...recall.equations[0], title: null, example: null }));
});
