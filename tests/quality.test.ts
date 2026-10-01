import test from "node:test";
import assert from "node:assert/strict";
import { mechanismPlanSchema, technicalReviewSchema, technicalDefects, validateMechanismPlan, technicalRepairTarget, type TechnicalReview } from "../worker/quality";
import { validateScene } from "../src/lib/scene";
import { generationSchemas, panelTextRepairSchema, recallRepairFields } from "../worker/generation-schema";
import { outputSchema } from "../worker/output-schema";

const sources = [{id:"method",label:"Methods",url:"https://arxiv.org/html/2503.01840#S3",excerpt:"Method evidence"}];
const plan = mechanismPlanSchema.parse({
  contribution:"Train on reused draft states",baseline:"Target-feature regression",evidenceScope:"full-text",
  steps:[{phase:"inference",input:"Prior state and token embedding",operation:"Concatenate, project, decode",output:"New state and token distribution",purpose:"Continue without another target pass",sourceIds:["method"]}],
  criticalDistinctions:["State vectors are not sampled tokens"], math:{essential:true,reason:"Explain the recurrence",computations:["Fusion and state reuse"]},
  walkthrough:{essential:true,reason:"Trace two draft steps"},diagram:{focus:"State reuse",transferredObjects:"State and token",omitted:"Other tree branches"},unknowns:[],
});
const pass = {verdict:"pass" as const,evidence:"The result describes the cited operation and its purpose.",sourceIds:["method"],repair:""};
const review = Object.fromEntries(Object.keys(technicalReviewSchema.shape).map(key=>[key,{...pass}])) as TechnicalReview;
const recall = {equations:[{title:"Continue the draft",latex:"a=D(u)",explanation:"Decoder produces a state.",example:"A worked trace.",sourceId:"method"}]};

test("required mechanism coverage cannot be waived by an otherwise positive reviewer",()=>{
  const defects=technicalDefects(plan,{equations:[]},{...review,notation:{...pass,verdict:"not-applicable"},example:{...pass,verdict:"not-applicable"}},sources);
  assert.ok(defects.some(d=>d.includes("Missing equations")));
  assert.ok(defects.some(d=>d.includes("Missing the required worked")));
  assert.ok(defects.some(d=>d.includes("cannot be waived")));
});

test("generation restricts every citation field to supplied sources", () => {
  const schema = generationSchemas(["method", "results"]).recall;
  assert.throws(() => schema.shape.sourceIds.parse(["invented"]));
  assert.throws(() => schema.shape.equations.parse([{ title: "Equation", latex: "x=1", explanation: "An illustrative value", example: null, sourceId: "invented" }]));
  const json = outputSchema(schema) as any;
  assert.deepEqual(json.properties.sourceIds.items.enum, ["method", "results"]);
  assert.deepEqual(schema.shape.sourceIds.parse(["method"]), ["method"]);
});

test("recall citation inventory can retain all fourteen supplied sources during a repair", () => {
  const ids = Array.from({ length: 14 }, (_, i) => `source-${i}`);
  assert.deepEqual(generationSchemas(ids).recall.shape.sourceIds.parse(ids), ids);
});

test("targeted recall repairs retain fields the reviewer did not reject", () => {
  assert.deepEqual(recallRepairFields(["evidence: Missing benchmark denominator"]), ["evidence"]);
  assert.deepEqual(recallRepairFields(["example: Missing final operation", "diagram: Incorrect transfer"]), ["equations", "walkthrough"]);
  assert.equal(recallRepairFields(["scope: Unsupported claim"]), undefined);
  const schema = generationSchemas(["method"]).recall.pick({ evidence: true });
  const patch = schema.parse({ evidence: "Corrected benchmark", mechanism: "A regressed mechanism" });
  assert.deepEqual({ mechanism: "Original mechanism", ...patch }, { mechanism: "Original mechanism", evidence: "Corrected benchmark" });
});
test("one technical failure blocks publication independently of all other checks",()=>{
  const defects=technicalDefects(plan,recall,{...review,diagram:{...pass,verdict:"fail",evidence:"Diagram conflates tokens with states.",repair:"Separate the state and sampled token."}},sources);
  assert.equal(defects.length,1);
  assert.match(defects[0],/Separate the state/);
  assert.equal(technicalRepairTarget(defects), "scene");
  const evidence = technicalDefects(plan,recall,{...review,evidence:{...pass,verdict:"fail",evidence:"Benchmark scope is missing.",repair:"Identify the hardware."}},sources);
  assert.equal(technicalRepairTarget(evidence), "recall");
  assert.equal(technicalRepairTarget([...defects, ...evidence]), "both");
});
test("reviews cannot omit checks or invent supporting source references",()=>{
  assert.throws(()=>technicalReviewSchema.parse({contribution:pass}));
  assert.ok(technicalDefects(plan,recall,{...review,computation:{...pass,sourceIds:["invented"]}},sources).length);
  assert.ok(technicalDefects(plan,recall,{...review,contribution:{...pass,sourceIds:[]}},sources).length);
  assert.deepEqual(technicalDefects(plan,recall,review,sources),[]);
});
test("planning must respect available evidence and not force unsupported detail",()=>{
  assert.doesNotThrow(()=>validateMechanismPlan(plan,sources,"full-text"));
  assert.throws(()=>validateMechanismPlan(plan,sources,"abstract"));
  assert.throws(()=>validateMechanismPlan({...plan,evidenceScope:"abstract"},sources,"abstract"));
  assert.throws(()=>validateMechanismPlan({...plan,steps:[{...plan.steps[0],sourceIds:["invented"]}]},sources,"full-text"));
  const qualitative={...plan,evidenceScope:"abstract" as const,unknowns:["Methods unavailable"],math:{essential:false,reason:"No supported equations",computations:[]},walkthrough:{essential:false,reason:"Methods unavailable"}};
  assert.doesNotThrow(()=>validateMechanismPlan(qualitative,sources,"abstract"));
  assert.deepEqual(technicalDefects(qualitative,{}, {...review,notation:{...pass,verdict:"not-applicable"},example:{...pass,verdict:"not-applicable"},phases:{...pass,verdict:"not-applicable"}},sources),[]);
});

test("SVG rejects raw LaTeX rather than displaying unreadable source notation",()=>{
  const node=(id:string,x:number,label:string)=>({id,x,y:100,w:160,h:90,kind:"box",label,detail:"",emphasis:false});
  const scene={title:"A mechanism",description:"Two clear steps",footnote:"A precise takeaway",nodes:[node("a",40,"Input x₀"),node("b",400,"Output")],edges:[{from:"a",to:"b",label:"",dashed:false}]};
  assert.doesNotThrow(()=>validateScene(scene));
  assert.throws(()=>validateScene({...scene,nodes:[node("a",40,"$X_{in}$"),scene.nodes[1]]}),/not raw LaTeX/);
});

test("caption repair preserves panel order and forbids partial replacement", () => {
  const schema = panelTextRepairSchema(2);
  assert.doesNotThrow(() => schema.parse({ description: "Arrows indicate selections.", captions: ["Each token chooses one expert.", "Each expert chooses two tokens."] }));
  assert.throws(() => schema.parse({ description: "Arrows indicate selections.", captions: ["Only one caption."] }));
  assert.throws(() => panelTextRepairSchema(4));
  assert.equal(Object.keys(outputSchema(schema).properties || {}).join(","), "description,captions");
});


test("Unicode transpose and exponent glyphs are rendered through native SVG superscripts", async () => {
 const {diagramText}=await import("../src/lib/scene");
 assert.equal(diagramText("DSᵀD"),'DS<tspan baseline-shift="super" font-size="70%">T</tspan>D');
 assert.equal(diagramText("x²"),'x<tspan baseline-shift="super" font-size="70%">2</tspan>');
 assert.ok(!diagramText("Aᵀ & B").includes("ᵀ"));assert.match(diagramText("Aᵀ & B"),/&amp;/);
});


test("tall figure review slices overlap and retain the final portion",async()=>{
 const {reviewSlices}=await import("../worker/diagram-review");
 for(const height of [4000,3270,4999]){
  const views=reviewSlices(350,height);assert.ok(views.length>2);assert.equal(views[0].top,0);
  for(let i=1;i<views.length;i++)assert.ok(views[i].top<views[i-1].top+views[i-1].height);
  assert.equal(views.at(-1)!.top+views.at(-1)!.height,height);
 }
 assert.deepEqual(reviewSlices(350,600),[]);
});


test("diagram locations override mislabeled recall views for repair targeting",async()=>{
 const {visualRepairTarget}=await import("../worker/diagram-review");
 const defect={category:"incorrect-notation" as const,view:"recall" as const,location:"FlashAttention panel, GPU SRAM object",severity:"must-fix" as const,evidence:"The rendered state has an inconsistent width.",repair:"Repair the state grid."};
 assert.equal(visualRepairTarget([defect]),"scene");
 const recall={...defect,location:"recall equation for the output state"};assert.equal(visualRepairTarget([recall]),"recall");assert.equal(visualRepairTarget([defect,recall]),"both");
});
