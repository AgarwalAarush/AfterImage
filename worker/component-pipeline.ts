import { relationReviewContract, relationProvenancePrompt, relationProvenanceFailures } from "./equation-provenance";
import { candidateSchema, textBoundFindings } from "./text-bounds";
import { z } from "zod";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Paper, Source } from "../src/lib/types";
import { paperKit, projectPublishedPaper, componentIdSchema, visibleComponent } from "../src/lib/kit";
import { digest, markKitComponent, type ComponentPublication } from "../src/lib/kit-publication";
import { generationSchemas } from "./generation-schema";
import { figureSchema, studySchema, studySvg, studyPrompt, validateStudy } from "../src/lib/study";
import { prepareScene, validateScene, sceneSvg, sceneSvgMobile, sceneGraphSchema } from "../src/lib/scene";
import { validateIllustration, validateIllustrationSources } from "../src/lib/scene-illustration";
import { validateRecall } from "../src/lib/recall-validation";
import { inspectSvg } from "./diagram-review";
import { capabilityPrompt } from "./capabilities";
import { researchSources } from "./sources";
import type { ResearchBundle } from "../src/lib/research-bundle";
import { collectValidation, type ValidationFinding } from "./validation-findings";
import { repairCandidate, RepairFailure, fingerprint, canonicalizeDefects, defectScope, targetCatalog, applyPatch, patchSchema, type RepairContext, type RepairDefect, type RepairCheckpoint, type LedgerEntry } from "./repair-controller";
import { requestEdit, verifyObligations, reconcileDefectIdentities, assessRepresentationEdits, viableNativeFinding, reviewTargets, reviewCitations, targetingPrompt, type Model } from "./repair-model";
import { cataloguePreview, passageSelection, passageSourceText, referencedSourceIds, reconcileEvidence, bindScientificAuthority, validateEvidenceDecision, EvidenceSession } from "./evidence";
import { KitCheckpoints, kitRunSchema, newKitRun, validateKitComponentCheckpoint, type KitCheckpoint } from "./kit-checkpoint";
import { componentTeachingContract, componentReviewContract, evidenceContextContract, evidenceAvailability, retainComponentEvidence, evidenceGroups } from "./component-contracts";

const kitCapabilities = capabilityPrompt + "\nSTUDY FIGURE CAPABILITIES:\n" + studyPrompt;
const pipelineVersion = "library-components-v1";
const planSchema = z.object({
  requirements: z.array(z.string().min(10).max(400)).min(1).max(4),
  equations: z.array(z.string().min(5).max(300)).max(5),
  example: z.string().max(600),
  diagram: z.object({ proof: z.string().min(10).max(600), objects: z.number().int().min(2).max(6), representation: z.enum(["flow", "illustration"]) }),
  figures: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), question: z.string().min(10).max(400), kind: z.enum(figureSchema.options.map(s => s.shape.kind.value) as [string, ...string[]]) })).min(1).max(3),
  sourceIds: z.array(z.string()).min(1).max(14),
});
type Plan = z.infer<typeof planSchema>;
export type KitRuntime = {
  model: Model;
  render(svg: string, file: string, width: number): Promise<string[]>;
  progress(stage: "sources" | "planning" | "drafting" | "reviewing" | "publishing"): Promise<void>;
  publish(publication: ComponentPublication): Promise<{ revision: string }>;
  status(id: string, state: "pending" | "running" | "failed" | "blocked"): Promise<void>;
  dir: string; checkpointRoot: string; target?: string; studyOnly?: boolean;
  research?: ResearchBundle; initial?: { recall?: unknown; scene?: unknown; study?: { figures: unknown[]; quiz: unknown[] } };
  implementationDigest: string; runId: string; runMode?: "new" | "resume"; assertLease?: () => Promise<void>;
  /** Private receipt projection from this run's authenticated, active claim. */
  committedComponents?: { componentId: string; revision: string }[];
};
export type KitResult = { outcomes: { id: string; status: string; owner?: string; rounds?: number }[]; paper: Paper; failure?: { owner: string; reason: string; ledger: import("./repair-controller").LedgerEntry[]; rounds?: number } };
export class KitFailure extends RepairFailure {
  constructor(error: RepairFailure, public result: KitResult) { super(error.owner, error.message, error.ledger, error.rounds); this.name = "KitFailure"; }
}
const allGates = { source: true, math: true, teaching: true, geometry: true, visual: true, quiz: true } as const;
function registry(bundle: ResearchBundle): ResearchBundle {
  // Versioned excerpt identities prevent a later extraction from changing a prior citation.
  const catalogue = bundle.catalogue.map(s => ({ ...s, id: `${s.id.replace(/:[a-f0-9]{16}$/, "")}:${fingerprint([s.url, s.excerpt]).slice(0, 16)}` }));
  const byOld = new Map(bundle.catalogue.map((s, i) => [s.id, catalogue[i]]));
  return { ...bundle, catalogue, sources: bundle.sources.map(s => byOld.get(s.id)!), coverage: { ...bundle.coverage, sections: bundle.coverage.sections.map(s => ({ ...s, sourceIds: s.sourceIds.map(id => byOld.get(id)?.id || id) })) } };
}
export function componentValidation(id: string, content: unknown, sources: Source[]): ValidationFinding[] {
  const checks: Parameters<typeof collectValidation>[0] = [];
  const geometry: Parameters<typeof collectValidation>[0] = [];
  const native = id === "diagram" ? sceneGraphSchema : id === "quiz" ? studySchema.shape.quiz.min(2) : id.startsWith("figure:") ? figureSchema : undefined;
  const lengths = native ? textBoundFindings({content}, z.object({content:native})) : [];
  const fullCheck = (check: () => void) => { try { check(); } catch (error) {
    if (error instanceof z.ZodError && error.issues.every(i => i.code === "too_big" && i.origin === "string")) return;
    throw error;
  } };
  const add = (invariant: string, objectId: string, paths: string[], check: () => void, dependencies: string[] = [], fatal = false) => checks.push({ invariant, objectId, paths, check, dependencies, fatal });
  if (id === "explanation") {
    const recall = content as any;
    const base = { idea: "", problem: "", mechanism: "", evidence: "", limitation: "", significance: "", sourceIds: [] };
    add("citations", id, ["/content/sourceIds"], () => validateRecall({ ...base, sourceIds: recall.sourceIds }, sources));
    for (const field of ["idea", "problem", "mechanism", "evidence", "limitation", "significance"]) add("math", `${id}/${field}`, [`/content/${field}`], () => validateRecall({ ...base, [field]: recall[field] }, sources));
    recall.equations?.forEach((equation: any, index: number) => add("equation", `${id}/equation-${index}`, [`/content/equations/${index}`], () => validateRecall({ ...base, equations: [equation] }, sources)));
    if (recall.walkthrough) add("walkthrough", id, ["/content/walkthrough"], () => validateRecall({ ...base, walkthrough: recall.walkthrough }, sources));
  }
  else if (id === "diagram") {
    const graph = content as z.infer<typeof sceneGraphSchema>;
    const scene = {...graph, layout: graph.illustration ? "explanatory-v3" as const : "flow-v2" as const, nodes:graph.nodes.map(n=>({...n,x:20,y:60,w:240,h:100}))};
    add("scene", id, ["/content"], () => fullCheck(() => validateScene(scene)));
    scene.illustration?.panels.forEach((panel, index) => {
      add("panel-source", `${id}/panel-${index}`, [`/content/illustration/panels/${index}`], () => validateIllustrationSources({ ...scene.illustration!, panels: [panel] }, sources));
      add("panel-semantics", `${id}/panel-${index}`, [`/content/illustration/panels/${index}`], () => validateIllustration({ ...scene.illustration!, panels: [panel] }));
    });
    for (const [view, svg] of [["desktop", () => sceneSvg(scene)], ["narrow", () => sceneSvgMobile(scene)]] as const)
      geometry.push({invariant:`geometry-${view}`,objectId:id,paths:[],check: () => { const issues = inspectSvg(svg()); if (issues.length) throw new Error(issues.join("; ")); }});
  } else if (id === "quiz") {
    const quiz = content as z.infer<typeof studySchema>["quiz"];
    quiz.forEach((q, index) => {
      add("question", q.id, [`/content/${index}`], () => fullCheck(() => validateStudy({ figures: [], quiz: [q] }, sources)));
      add("question-identity", q.id, [`/content/${index}/id`], () => {if(quiz.filter(other=>other.id===q.id).length>1)throw Error("Duplicate quiz identifier");});
    });
  } else {
    const figure = content as z.infer<typeof figureSchema>;
    add("figure-source", id, ["/content"], () => fullCheck(() => validateStudy({ figures: [figure], quiz: [] }, sources)));
    add("source-identity", id, ["/content/sourceId"], () => {if(!sources.some(s=>s.id===figure.sourceId))throw Error("Figure cites an unknown source");});
    if (figure.kind === "illustration") figure.illustration.panels.forEach((panel, index) => {
      add("panel-source", `${id}/panel-${index}`, [`/content/illustration/panels/${index}`], () => validateIllustrationSources({ ...figure.illustration, panels: [panel] }, sources));
      add("panel-semantics", `${id}/panel-${index}`, [`/content/illustration/panels/${index}`], () => validateIllustration({ ...figure.illustration, panels: [panel] }));
      add("panel-provenance", `${id}/panel-${index}`, [`/content/illustration/panels/${index}/illustrative`], () => {if(figure.provenance==="reported"&&panel.illustrative)throw Error("Reported study illustration contains illustrative panels");}, ["/content/provenance"]);
    });
    for (const mobile of [false, true]) for (let state = 0; state < (figure.kind === "network" ? figure.states.length : 1); state++)
      geometry.push({invariant:`geometry-${mobile}-${state}`,objectId:id,paths:[],check: () => { const issues = inspectSvg(studySvg(figure, mobile, state)); if (issues.length) throw new Error(issues.join("; ")); }});
  }
  const findings = collectValidation(checks);
  // An aggregate validator repeats its first panel failure. Keep the localized
  // obligations, while retaining cross-panel/whole-component invariants.
  const localized = findings.filter(f=>!["scene","figure-source"].includes(f.invariant));
  const semantic = [...lengths,...findings.filter(f=>!["scene","figure-source"].includes(f.invariant)||!localized.some(p=>p.message===f.message))];
  // Rendering an invalid graph can throw the same semantic error or recurse.
  // Only inspect geometry after structural and semantic preconditions hold.
  return [...semantic,...(semantic.length ? [] : collectValidation(geometry))].flatMap(f => f.invariant.startsWith("geometry-") ? f.message.split("; ").map(message => ({ ...f, invariant: `${f.invariant}-${fingerprint(message).slice(0, 16)}`, message, paths: [] })) : [f]);
}

/** Every component is freshly reviewed; failed candidates never become public payloads. */
export async function generateKit(input: Paper, runtime: KitRuntime) {
  let paper = structuredClone(projectPublishedPaper(input));
  const { dir } = runtime;
  const started = Date.now(), calls: { name: string; elapsedMs: number; status: string }[] = [];
  const model: Model = async (prompt, schema, name, images) => {
    const began = Date.now(); let status = "failed";
    try { const result = await runtime.model(prompt, schema, name, images); status = "complete"; return result; }
    finally { calls.push({ name, elapsedMs: Date.now()-began, status }); await writeFile(path.join(dir, "model-calls.json"), JSON.stringify(calls)); }
  };
  await mkdir(dir, { recursive: true });
  const record = (name: string, value: unknown) => writeFile(path.join(dir, `${name}.json`), JSON.stringify(value, null, 2));
  const checkpoints = new KitCheckpoints(runtime.checkpointRoot, paper.id, runtime.assertLease);
  const outcomes: KitResult["outcomes"] = [];
  let ids: string[] = [], budgets = { opening: 4, supplement: 2 };
  const status: KitRuntime["status"] = async (id, state) => { await runtime.status(id, state); markKitComponent(paper, id, state); };
  const terminal = async (failure?: RepairFailure): Promise<KitResult> => {
    if (failure) for (const id of ids) if (!outcomes.some(o => o.id === id)) outcomes.push({ id, status: "not-run" });
    const result: KitResult = { outcomes, paper: projectPublishedPaper(paper), ...(failure ? { failure: { owner: failure.owner, reason: failure.message, ledger: failure.ledger, rounds: failure.rounds } } : {}) };
    await record("kit-quality-report", { version: pipelineVersion, implementationDigest: runtime.implementationDigest, status: failure ? "interrupted" : "complete", outcomes, budgets, calls: calls.length, elapsedMs: Date.now()-started, failure: result.failure });
    await record("result", result); return result;
  };
  try {
  const runBinding = fingerprint([runtime.runId, runtime.implementationDigest]);
  const previousRun = runtime.runMode === "resume" ? await checkpoints.read("run", runBinding) : undefined;
  if (runtime.runMode === "resume" && !previousRun) throw new RepairFailure("execution", "Recovery run checkpoint is unavailable or incompatible; request an explicit new retry.");
  let run = newKitRun();
  try { if (previousRun) run = kitRunSchema.parse(previousRun.candidate); }
  catch { throw new RepairFailure("execution", "Recovery run checkpoint is invalid; request an explicit new retry."); }
  if (new Set(run.completed).size !== run.completed.length || new Set(run.started).size !== run.started.length || run.completed.some(id => !run.started.includes(id) || !run.completedRevisions[id]) || Object.keys(run.completedRevisions).some(id => !run.completed.includes(id))) throw new RepairFailure("execution", "Recovery run checkpoint has inconsistent component identities.");
  let committedComponents: NonNullable<KitRuntime["committedComponents"]> = [];
  try { if (previousRun) committedComponents = z.array(z.object({ componentId: componentIdSchema, revision: z.string().min(1).max(80) }).strict()).max(6).parse(runtime.committedComponents ?? []); }
  catch { throw new RepairFailure("execution", "Recovery completion receipt projection is invalid."); }
  const saveRun = () => checkpoints.write({ version: 1, binding: runBinding, componentId: "run", candidate: run });
  if (!previousRun) await saveRun();
  budgets = { opening: 4 - run.used.opening, supplement: 2 - run.used.supplement };
  const fallbacks = run.fallbacks, enrichments = run.enrichments;
  if (!previousRun) await runtime.progress("sources");
  let bundle = registry(runtime.research ?? await researchSources(paper));
  await record("research", bundle);
  const citation = z.enum(bundle.catalogue.map(s => s.id) as [string, ...string[]]);
  if (!previousRun) await runtime.progress("planning");
  const planBinding = fingerprint([pipelineVersion, runtime.implementationDigest, bundle.catalogue, paper.id]);
  const savedPlan = await checkpoints.read("plan", planBinding);
  if (previousRun && !savedPlan?.candidate) throw new RepairFailure("execution", "Recovery plan checkpoint is unavailable or incompatible.");
  let plan: Plan;
  if (savedPlan?.candidate) plan = planSchema.parse(savedPlan.candidate);
  else {
    plan = await model("Plan a bounded Library refresher. At most FOUR essential teaching requirements and five essential equation requirements. Keep each requirement to 15–30 words and each equation entry to a short name, source relation and domain (not a full LaTeX derivation). Keep the diagram proof below 300 characters and the example below 300 characters. These are planning notes, not reader prose. Label derived relations and source conventions explicitly. Distinguish essential computations from optional detail. The explanation must stand alone without any diagram. Choose ONE narrow opening visual proof using at most six objects and one small consistent illustrative example. Plan one useful independent study figure by default; add a second or third only when an essential requirement cannot be taught by the explanation and opening figure. Never use a numeric network for a nonnumeric workflow. Every figure must teach the contribution or a necessary prerequisite; do not force unrelated plots. Require only supported mathematics. The quiz must be answerable from the explanation alone. Check all dimensions and representation bounds against CAPABILITIES. Source IDs must refer to evidence actually supplied.\nCAPABILITIES:\n" + kitCapabilities + "\nPAPER AND EVIDENCE:\n" + JSON.stringify({ title: paper.title, scope: bundle.scope, sources: bundle.sources, coverage: bundle.coverage }), planSchema.extend({ sourceIds: z.array(citation).min(1).max(14) }), "kit-plan");
    plan.figures = plan.figures.map((f, i) => ({ ...f, id: paper.study?.figures[i]?.id ?? f.id }));
    if (new Set(plan.figures.map(f => f.id)).size !== plan.figures.length) throw new RepairFailure("schema", "Duplicate planned figure identity");
    const required = await model("Check this proposed teaching plan against the extraction coverage and capability bounds. Select up to fourteen catalogue excerpts that can establish ALL essential requirements, equations and example. If missing, identify the unavailable requirement instead of inventing it. For planned algorithms, normalization and cost equations, include corresponding same-version implementation listings and boundary-condition appendices when available. Preview gaps are not evidence that a rule is absent. An abstract-only plan must stay within abstract support.\n" + JSON.stringify({ plan, coverage: bundle.coverage, catalogue: bundle.catalogue.map(s => ({ id: s.id, label: s.label, preview: cataloguePreview(s.excerpt) })) }), z.object({ sourceIds: z.array(citation).min(1).max(14) }), "plan-evidence");
    const planSources = bundle.catalogue.filter(s => required.sourceIds.includes(s.id));
    // Evidence selection replaces the context, not the underlying source registry.
    // Bind the plan to that selected context before any claim-feasibility review.
    plan.sourceIds = planSources.map(s=>s.id);
    const boundPlanSchema = planSchema.extend({sourceIds:z.array(z.enum(plan.sourceIds as [string,...string[]])).min(1).max(14)});
    for (let attempt = 0; ; attempt++) {
      const catalog = targetCatalog(plan, boundPlanSchema);
      const feasibility = await model("Independently verify every proposed essential equation, teaching requirement and example against these exact excerpts and native field/representation bounds. Identify the smallest native fields that need correction. Optional elaboration cannot become essential later. Distinguish a source definition from your generalized formula; restrict its domain instead of silently changing the author equation. No blockers means feasible.\nCAPABILITIES:\n" + kitCapabilities + "\n" + JSON.stringify({ plan, targets: catalog.map(t => t.path), sources: planSources, scope: bundle.scope }), z.object({ feasible: z.boolean(), blockers: z.array(z.object({ target: z.enum(catalog.map(t => t.path) as [string,...string[]]), reason: z.string().min(1).max(800) })).max(10) }), `plan-feasibility-${attempt}`);
      feasibility.blockers.push(...textBoundFindings(plan, boundPlanSchema).map(f => ({target: f.paths[0], reason: f.message + ". Rewrite concisely; never truncate."})));
      await record(`plan-feasibility-${attempt}`, feasibility);
      if (feasibility.feasible && !feasibility.blockers.length) break;
      if (!feasibility.blockers.length || budgets.opening <= 0) throw new RepairFailure("content", "Essential plan is unsupported or exceeds representation bounds");
      const selectedTargets = catalog.filter(t => feasibility.blockers.some(b => b.target === t.path));
      const targets = selectedTargets.filter(t => !selectedTargets.some(p => t.path.startsWith(p.path + "/")));
      run.used.opening++; budgets.opening--; await saveRun();
      const patch = await model("Correct only these bounded planning defects using primary evidence. Every target includes its native character bound. Aim below 60% of maxLength using complete short sentences; remove repeated context and prefixes. Do not copy the long reviewer demand into the field. Equations here are short relation requirements, not full derivations. Preserve every unrelated plan field and do not add scope. Return the exact preimage-bound patch.\n" + JSON.stringify({ plan, blockers: feasibility.blockers, targets: targets.map((t,i) => ({ key: `t${i}`, path: t.path, value: t.value, preimage: t.fingerprint, constraints: t.constraints })), sources: planSources }), patchSchema(targets, fingerprint(plan)), `plan-edit-${attempt}`);
      plan = applyPatch(plan, boundPlanSchema, targets, patch);
      await record(`plan-candidate-${attempt}`, plan);
    }
    await checkpoints.write({ version: 1, binding: planBinding, componentId: "plan", candidate: plan });
  }
  await record("plan", plan);
  ids = runtime.target ? [componentIdSchema.parse(runtime.target)] : [...(runtime.studyOnly ? [] : ["explanation", "diagram"]), ...plan.figures.map(f => `figure:${f.id}`), "quiz"];
  const kit = paperKit(paper);
  // Publication and its receipt commit together. A reclaimed worker can recover
  // that fact without replaying the mutation or accepting the previous token.
  for (const receipt of committedComponents) if (ids.includes(receipt.componentId) && run.started.includes(receipt.componentId) && kit.components.some(c => c.id === receipt.componentId && c.revision === receipt.revision) && visibleComponent(kit, receipt.componentId)) {
    if (!run.completed.includes(receipt.componentId)) run.completed.push(receipt.componentId);
    run.completedRevisions[receipt.componentId] = receipt.revision;
  }
  run.completed = run.completed.filter(id => run.completedRevisions[id] && kit.components.some(c => c.id === id && c.revision === run.completedRevisions[id]) && visibleComponent(kit, id));
  run.completedRevisions = Object.fromEntries(run.completed.map(id => [id, run.completedRevisions[id]]));
  // Persist reconciled authority under the current lease before status writes,
  // component restoration or any new generation/review call.
  await saveRun();
  if (previousRun) { await runtime.progress("sources"); await runtime.progress("planning"); }
  const restored = new Map<string, KitCheckpoint>();
  if (previousRun) for (const id of run.started) {
    if (run.completed.includes(id)) continue;
    const dependencies = id === "explanation" ? {} : { explanation: kit.components.find(c => c.id === "explanation")?.revision };
    const binding = fingerprint([planBinding, id, dependencies]);
    const saved = await checkpoints.read(id, binding);
    if (!saved) throw new RepairFailure("execution", `Recovery component checkpoint is unavailable or incompatible: ${id}.`);
    try {
      const native = id === "explanation" ? generationSchemas(saved.sources?.map(s => s.id) ?? []).recall : id === "diagram" ? generationSchemas(saved.sources?.map(s => s.id) ?? []).scene : id === "quiz" ? studySchema.shape.quiz.min(2) : figureSchema;
      validateKitComponentCheckpoint(saved, candidateSchema(z.object({ content: native })));
      if (saved.repair!.round > run.used[["explanation", "diagram"].includes(id) ? "opening" : "supplement"]) throw new Error("Component round exceeds reserved allowance");
      if (saved.sources!.some(source => !bundle.catalogue.some(original => fingerprint(original) === fingerprint(source)))) throw new Error("Checkpoint source differs from immutable catalogue");
    } catch { throw new RepairFailure("execution", `Recovery component checkpoint is invalid: ${id}.`); }
    restored.set(id, saved);
  }
  for (const id of ids.filter(id => !run.completed.includes(id))) await status(id, "pending");
  for (const id of ids) {
    if (run.completed.includes(id)) { outcomes.push({ id, status: "passed" }); continue; }
    const stage = ["explanation", "diagram"].includes(id) ? "opening" : "supplement";
    if (id !== "explanation" && !paper.recall) { await status(id, "blocked"); outcomes.push({ id, status: "blocked" }); continue; }
    const dependencies: Record<string, string> = id === "explanation" ? {} : { explanation: paperKit(paper).components.find(c => c.id === "explanation")!.revision! };
    const teaching = componentTeachingContract(plan, id);
    const parentBinding = fingerprint([planBinding, id, dependencies]);
    const componentDir = path.join(dir, id.replace(":", "-")); await mkdir(componentDir, { recursive: true });
    const componentRecord = (name: string, value: unknown) => writeFile(path.join(componentDir, `${name}.json`), JSON.stringify(value, null, 2));
    const call: Model = (prompt, schema, name, images) => model(prompt, schema, `${id.replace(":", "-")}-${name}`, images);
    let spent = 0, startRound = 0;
    let failureCheckpoint: (() => Promise<void>) | undefined;
    const usedBefore = run.used[stage];
    try {
      if (!run.started.includes(id)) { run.started.push(id); await saveRun(); }
      await status(id, "running");
      const purpose = id.startsWith("figure:") ? plan.figures.find(f => `figure:${f.id}` === id)?.question ?? paper.study?.figures.find(f => `figure:${f.id}` === id)?.title : id === "diagram" ? plan.diagram.proof : plan.requirements.join("\n");
      const saved = restored.get(id) ?? (!previousRun ? await checkpoints.read(id, parentBinding) : undefined);
      const selected = saved?.sources ? { sourceIds: saved.sources.map(s => s.id) } : await call("Select the minimum primary evidence needed to generate and review this component, including relevant appendices, equations and reported conditions. Include corresponding same-version implementation listings for algorithm/cost claims; inspect exceptional, null and empty branches rather than relying on the main-text formula alone. Return catalogue IDs only.\nCOMPONENT:\n" + JSON.stringify({ id, purpose, teaching }) + "\nCATALOGUE:\n" + JSON.stringify(bundle.catalogue.map(s => ({ id: s.id, label: s.label, preview: cataloguePreview(s.excerpt) }))), z.object({ sourceIds: z.array(citation).min(1).max(14) }), "select-sources");
      const baseline = saved?.candidate ?? (id === "explanation" ? runtime.initial?.recall : id === "diagram" ? runtime.initial?.scene : id === "quiz" ? runtime.initial?.study?.quiz : runtime.initial?.study?.figures.find((f: any) => `figure:${f.id}` === id));
      const remapCitations = (value: any): any => Array.isArray(value) ? value.map(remapCitations) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, v]) => [key, key === "sourceId" ? bundle.catalogue.find(s => s.id.replace(/:[a-f0-9]{16}$/, "") === v)?.id ?? v : key === "sourceIds" && Array.isArray(v) ? v.map(id => bundle.catalogue.find(s => s.id.replace(/:[a-f0-9]{16}$/, "") === id)?.id ?? id) : remapCitations(v)])) : value;
      let sources = retainComponentEvidence(bundle.catalogue, saved?.sources ?? bundle.catalogue.filter(s => selected.sourceIds.includes(s.id)), plan.sourceIds, referencedSourceIds(remapCitations(baseline)));
      let focused = saved?.focusedSources ?? sources.slice(0, 14);
      const evidenceCache = new Map<string, Awaited<ReturnType<typeof reconcileEvidence>>>(saved?.evidenceDecisions as [string, Awaited<ReturnType<typeof reconcileEvidence>>][] ?? []);
      const session = new EvidenceSession({ ...bundle, sources: focused }, paper.title); session.passes = enrichments[stage];
      const shape = () => id === "explanation" ? generationSchemas(sources.map(s => s.id)).recall : id === "diagram" ? generationSchemas(sources.map(s => s.id)).scene : id === "quiz" ? studySchema.shape.quiz.min(2) : figureSchema;
      let schema = z.object({ content: shape() });
      const binding: Record<string, unknown> = { version: pipelineVersion, implementation: runtime.implementationDigest, parent: parentBinding, sources: fingerprint(sources), plan: fingerprint(plan), teaching: fingerprint(teaching) };
      const sourceData = (group: Source[]) => ({ title: paper.title, scope: bundle.scope, sources: group, evidenceAvailability: evidenceAvailability(bundle.catalogue, group, bundle.catalogue.map(s=>s.id)) });
      const sourceText = () => JSON.stringify(sourceData(focused));
      await runtime.progress("drafting");
      const instruction = "Create only the named component, with complete sentences and exact source citations. Teach only the named component's owned teaching contract without adding another component's coverage. Global requirements and equations remain mandatory in the explanation. Equations use KaTeX and define every symbol, dimension, exceptional/null branch and source-versus-derived origin. Mark invented examples illustrative. Respect native field bounds; never truncate text. The explanation is a substantial 400–600 word technical refresher and must make sense without images. Diagrams supply semantic data only. Study figures use the requested stable ID. Quiz questions and every distractor explanation must be independently answerable from the explanation and primary sources, with no dependence on pending figures. Never refer to unavailable diagrams.\n";
      let initial = baseline ? candidateSchema(schema).parse(saved?.candidate ?? { content: remapCitations(baseline) }) : await call(instruction + kitCapabilities + "\nCOMPONENT:\n" + JSON.stringify({ id, purpose, teaching, explanation: id === "explanation" ? undefined : paper.recall }) + "\nPRIMARY EVIDENCE:\n" + sourceText(), schema, "draft");
      sources = retainComponentEvidence(bundle.catalogue, sources, plan.sourceIds, referencedSourceIds(initial));
      focused = saved?.focusedSources ?? sources.slice(0, 14); session.bundle = { ...session.bundle, sources: focused }; schema = z.object({ content: shape() });
      binding.sources = fingerprint(sources);
      if (id.startsWith("figure:") && (initial.content as any).id !== id.slice(7)) throw new RepairFailure("schema", "Draft changed figure identity");
      const inspect = (candidate: typeof initial) => [...new Map([...textBoundFindings(candidate, schema), ...componentValidation(id, candidate.content, sources)].map(f=>[`${f.objectId}:${f.invariant}`,f])).values()];
      const validate = (candidate: typeof initial) => { const issues = inspect(candidate); if (issues.length) throw new Error(issues.map(f => `${f.objectId}: ${f.message}`).join("; ")); };
      startRound = previousRun && saved?.repair ? saved.repair.round : 0;
      if (previousRun && saved?.repair?.replanned) fallbacks[stage] = true;
      let latestState: RepairCheckpoint<typeof initial> | undefined;
      const checkpoint = async (state: RepairCheckpoint<typeof initial>) => {
        latestState = structuredClone(state);
        spent = state.round - startRound;
        if (state.replanned) fallbacks[stage] = true;
        enrichments[stage] = session.passes;
        const evidenceDecisions = [...evidenceCache.entries()];
        const value = validateKitComponentCheckpoint({ version: 1, binding: parentBinding, componentId: id, candidate: state.candidate, repair: state, sources, focusedSources: focused, evidenceDecisions, exhausted: spent >= budgets[stage] }, candidateSchema(schema));
        run.used[stage] = usedBefore + spent; await saveRun();
        await checkpoints.write(value);
        await componentRecord("evidence-history", evidenceDecisions);
      };
      failureCheckpoint = async () => { if (latestState) await checkpoint(latestState); };
      const outcome = await repairCandidate(initial, {
        schema: () => schema, binding, maxRepairs: budgets[stage] + startRound, replanAvailable: !fallbacks[stage], allowRepresentationFallback: id !== "explanation" && id !== "quiz", inspect, validate,
        // Resume the candidate; an explicitly requested retry gets a fresh bounded stage budget.
        resume: saved?.repair ? { ...saved.repair, round: startRound, replanned: fallbacks[stage], seen: previousRun ? saved.repair.seen : [] } as RepairCheckpoint<typeof initial> : undefined,
        checkpoint,
        record: async (name, value) => { if (name.startsWith("replan-")) { fallbacks[stage] = true; await saveRun(); } await componentRecord(name, value); },
        review: async (candidate, context) => {
          const reviewRecord = async (name: string, value: unknown, findings: RepairDefect[], disputedIds: string[] = []) => {
            try { await componentRecord(name, value); }
            catch {
              // Carry findings through the controller's merge/checkpoint path.
              // Pending verification has not passed controller validation yet.
              const retained = new Map<string, LedgerEntry>(context.obligations.map(entry => [entry.id, entry]));
              for (const finding of findings) {
                const previous = context.history?.find(entry => entry.id === finding.id);
                retained.set(finding.id, { ...previous, ...finding, sourceProof: finding.sourceProof, verification: undefined,
                  status: disputedIds.includes(finding.id) ? "disputed" : previous ? "recurring" : "open", occurrences: (previous?.occurrences ?? 0) + 1 });
              }
              throw new RepairFailure("execution", "Private review diagnostic did not persist.", [...retained.values()], context.round);
            }
          };
          await runtime.progress("reviewing");
          const deterministic = inspect(candidate);
          const images: string[] = [];
          if (!deterministic.length && id === "diagram") {
            const scene = prepareScene(candidate.content as any);
            images.push(...await runtime.render(sceneSvg(scene), path.join(componentDir, `desktop-${context.round}.png`), 880));
            images.push(...await runtime.render(sceneSvgMobile(scene), path.join(componentDir, `narrow-${context.round}.png`), 350));
          } else if (!deterministic.length && id.startsWith("figure:")) {
            const figure = candidate.content as z.infer<typeof figureSchema>;
            for (const narrow of [false, true]) for (let state = 0; state < (figure.kind === "network" ? figure.states.length : 1); state++) images.push(...await runtime.render(studySvg(figure, narrow, state), path.join(componentDir, `${narrow}-${state}-${context.round}.png`), narrow ? 350 : 760));
          }
          const proof = passageSelection(focused);
          const findingSchema = z.object({ requiredValues: z.array(z.object({ target: z.enum(context.catalog.map(t=>t.path) as [string,...string[]]), value: z.string().min(1).max(160) })).max(4).optional(), evidenceStatus: z.enum(["scientific", "unsupported-by-supplied", "known-omitted"]).optional(), requiredSourceIds: z.array(citation).max(4).optional(), invariant: z.string().min(3).max(160), objectId: z.string().min(1).max(160), owner: z.enum(["content", "representation", "renderer", "schema"]), targets: reviewTargets(context), dependencies: reviewTargets(context).optional(), evidence: z.string().min(1).max(2000), acceptance: z.string().min(1).max(2000), sourceIds: reviewCitations(focused.map(s => s.id)) });
          const reviewSchema = z.object({ approved: z.boolean(), contextRequests: z.array(citation).max(4).optional(), findings: z.array(findingSchema).max(20), equationAudits: z.array(z.object({ index: z.number().int().min(0).max(4), fingerprint: z.string().length(64), passed: z.boolean(), passageIds: proof.ids })).max(5) });
          const equationList = id === "explanation" ? ((candidate.content as any).equations ?? []).map((eq: unknown, index: number) => ({ index, fingerprint: fingerprint(eq), equation: eq })) : [];
          const technicalReviews = [];
          const reviewGroups = evidenceGroups(sources);
          for (const group of reviewGroups) {
          const groupEquations = equationList.filter((a: any) => group.some(s => s.id === a.equation.sourceId));
          const technical = await call(componentReviewContract + "\n" + evidenceContextContract + "\nReview only scientific claims whose cited sources are in THIS evidence group. Other source groups receive separate independent reviews; absence from this group is not missing evidence. Audit only the listed group equations. Independently review source support, all mathematics, teaching completeness and dependency independence. Validate every quiz option, correct answer and explanation. For every explanation equation return an audit with the received fingerprint and exact passage IDs; check units, definitions, exceptional branches and derived provenance. Cite only received sources. Do not invent numerical support. Unsupported illustrative values require truthful disclosure, not fabricated attribution. A component must be understandable using ONLY the published explanation and its own text; unavailable figure references are blockers. Report one finding per independently correctable object and invariant. Split missed essential equations or requirements into separate obligations rather than a single blanket completeness demand. Report actionable native fields and stable scientific invariants, preserving the objectId and invariant of an existing obligation when its wording/localization changes. Identify validation dependencies such as parent provenance. Optional teaching expansion is not a defect. Approved requires zero substantive findings.\n" + targetingPrompt(context) + "\nCOMPONENT:\n" + JSON.stringify({ id, candidate, teaching, dependencies, equations: groupEquations, deterministic, explanation: id === "explanation" ? undefined : paper.recall }) + "\nPRIMARY EVIDENCE:\n" + passageSourceText(JSON.stringify(sourceData(group))), reviewSchema.extend({ findings: z.array(findingSchema.extend({ sourceIds: reviewCitations(group.map(s => s.id)) })).max(20), equationAudits: z.array(z.object({ index: z.number().int().min(0).max(4), fingerprint: z.string().length(64), passed: z.boolean(), passageIds: passageSelection(group).ids })).length(groupEquations.length) }), `source-review-${context.round}-${fingerprint(group).slice(0, 8)}`);
          if (technical.equationAudits.length !== groupEquations.length || technical.equationAudits.some((a, i) => a.index !== groupEquations[i].index || a.fingerprint !== groupEquations[i].fingerprint)) throw new RepairFailure("schema", "Missing exact equation audit");
          if (technical.equationAudits.some(a => !a.passed) && !technical.findings.length) throw new RepairFailure("schema", "Equation audit rejected without findings");
          let relationAudits: ReturnType<ReturnType<typeof relationReviewContract>["validate"]>["receipts"] = [];
          if(groupEquations.length){
            const provenance=relationReviewContract(candidate,(candidate.content as any).equations,"/content/equations",context.binding!,group,groupEquations.map((entry:any)=>entry.index));
            const received=await call(relationProvenancePrompt+"\nRELATION SCOPES:\n"+JSON.stringify(provenance.scopes)+"\nCANDIDATE ATTRIBUTION SPANS:\n"+JSON.stringify(provenance.spans)+"\nCOMPONENT:\n"+JSON.stringify({id,candidate,teaching})+"\nPRIMARY EVIDENCE:\n"+passageSourceText(JSON.stringify(sourceData(group))),provenance.schema,`relation-review-${context.round}-${fingerprint(group).slice(0,8)}`);
            relationAudits=provenance.validate(received).receipts;
            const failures=relationProvenanceFailures(relationAudits);technical.findings.push(...failures);if(failures.length)technical.approved=false;
          }
          technicalReviews.push({...technical,relationAudits,findings:technical.findings.map(f=>f.requiredSourceIds?.some(sourceId=>!group.some(s=>s.id===sourceId))?{...f,evidenceStatus:"known-omitted" as const}:f)});
          }
          const technical = { approved: technicalReviews.every(r => r.approved), findings: technicalReviews.flatMap(r => r.findings), equationAudits: technicalReviews.flatMap(r => r.equationAudits), relationAudits: technicalReviews.flatMap(r=>r.relationAudits), contextRequests: technicalReviews.flatMap(r=>r.contextRequests??[]) };
          const visualReviews = [];
          if(images.length)for(const group of reviewGroups) {
            visualReviews.push(await call(componentReviewContract + "\n" + evidenceContextContract + "\nIndependently inspect ALL attached rendered views/states. Check actual labels, arrow endpoints, grouping, collisions, units and depicted scientific relationships whose cited sources are in THIS evidence group. Other groups receive separate reviews; known omitted evidence is a context request, never a missing-source defect. Semantic JSON alone cannot establish visual approval. Report exact field targets; use renderer ownership only for a geometry defect native data cannot correct. Never waive a source or geometry failure.\n" + targetingPrompt(context) + "\nCOMPONENT:\n" + JSON.stringify({id,candidate,teaching,dependencies,explanation:id==="explanation"?undefined:paper.recall,deterministic}) + "\nPRIMARY EVIDENCE:\n" + passageSourceText(JSON.stringify(sourceData(group))), reviewSchema.extend({findings:z.array(findingSchema.extend({sourceIds:reviewCitations(group.map(s=>s.id))})).max(20),equationAudits:reviewSchema.shape.equationAudits.max(0)}), `visual-review-${context.round}-${fingerprint(group).slice(0,8)}`, images).then(review=>({...review,findings:review.findings.map(f=>f.requiredSourceIds?.some(sourceId=>!group.some(s=>s.id===sourceId))?{...f,evidenceStatus:"known-omitted" as const}:f)})));
          }
          const visual = {approved:images.length?visualReviews.every(r=>r.approved):!deterministic.length,findings:visualReviews.flatMap(r=>r.findings),equationAudits:[],contextRequests:visualReviews.flatMap(r=>r.contextRequests??[])};
          const nativeBounds = deterministic.filter(f => f.invariant === "native-text-length");
          const receivedFindings = [...technical.findings, ...visual.findings];
          const omittedFindings = receivedFindings.filter(f=>f.evidenceStatus==="known-omitted");
          if(omittedFindings.some(f=>!f.requiredSourceIds?.length))throw new RepairFailure("schema","Known omitted evidence requires explicit context IDs.");
          const contextRequests = [...new Set([...technical.contextRequests,...visual.contextRequests,...omittedFindings.flatMap(f=>f.requiredSourceIds??[])])];
          const raw = receivedFindings.filter(f=>f.evidenceStatus!=="known-omitted").filter(f => !nativeBounds.some(n => f.invariant === n.invariant && f.objectId === n.objectId));
          for (const finding of deterministic.filter(f => f.invariant !== "native-text-length")) {
            if (raw.some(f => f.objectId === finding.objectId && f.invariant === finding.invariant)) continue;
            const geometry = finding.invariant.startsWith("geometry-");
            const targets = geometry ? [] : context.catalog.filter(t => [...finding.paths, ...finding.dependencies].some(p => t.path === p || t.path.startsWith(p + "/"))).filter(t => !context.catalog.some(parent => parent.path !== t.path && t.path.startsWith(parent.path + "/") && [...finding.paths, ...finding.dependencies].includes(parent.path))).slice(0,24).map(t => t.path);
            raw.push({ invariant: finding.invariant, objectId: finding.objectId, owner: geometry ? "renderer" : "content", targets, dependencies: finding.dependencies, evidence: finding.message, acceptance: "Correct the named deterministic invariant without changing unrelated content or scientific claims.", sourceIds: focused.map(s => s.id) });
          }
          if ((!technical.approved || !visual.approved) && !raw.length && !nativeBounds.length && !contextRequests.length) throw new RepairFailure("schema", "Rejected review has no actionable finding");
          const newlyNamed: RepairDefect[] = raw.map(f => viableNativeFinding(f, context)).map(f => ({ ...f, id: fingerprint([f.objectId, f.invariant.toLowerCase().replaceAll("_", "-")]).slice(0, 32), category: ((["renderer", "representation"].includes(f.owner) ? "visual-" : "scientific-") + f.invariant).slice(0, 80), artifact: ["renderer", "representation"].includes(f.owner) ? "/content" : undefined }));
          const identified = await reconcileDefectIdentities(call, newlyNamed, candidate, context);
          let defects = canonicalizeDefects(await assessRepresentationEdits(call, candidate, identified, context, sourceText()+"\n"+kitCapabilities), { discardProofs: true });
          await reviewRecord(`defect-identities-${context.round}`, {candidate:context.fingerprint,findings:newlyNamed,canonical:defects}, defects);
          if(contextRequests.length) {
            if(contextRequests.length>4||session.passes>=2)throw new RepairFailure("content","Evidence enrichment exhausted with unresolved context requests",context.obligations,context.round);
            sources=retainComponentEvidence(bundle.catalogue,sources,plan.sourceIds,contextRequests);
            focused=[...new Set([...contextRequests,...focused.map(s=>s.id)])].slice(0,14).map(sourceId=>sources.find(s=>s.id===sourceId)!);
            session.bundle={...session.bundle,sources:focused};session.passes++;enrichments[stage]=session.passes;binding.sources=fingerprint(sources);schema=z.object({content:shape()});
            return {defects,verified:[],complete:false,refresh:true};
          }
          const verified = await verifyObligations(call, candidate, context, sourceText(), images);
          const unresolved = context.obligations.filter(d => !verified.some(v => v.id === d.id && v.resolved));
          // Reconcile supported edits individually so one unrelated dispute cannot stop them.
          const canonical = canonicalizeDefects([...defects, ...unresolved], { discardProofs: true });
          const decisions = [];
          for (const defect of canonical) {
            const wanted = new Set([...defect.sourceIds, ...focused.map(s => s.id)]);
            const group = [...wanted].slice(0, 14).map(id => sources.find(s => s.id === id)).filter((s): s is Source => !!s);
            const key = fingerprint([context.binding, candidate, group, teaching, defect]);
            let decision = evidenceCache.get(key);
            if (!decision) { decision = await reconcileEvidence(call, [defect], candidate, context, { ...session.bundle, sources: group }, paper.title, { teaching, evidenceAvailability: evidenceAvailability(bundle.catalogue, group, bundle.catalogue.map(s=>s.id)), evidenceContextContract }); evidenceCache.set(key, decision); }
            decision.forEach(d => validateEvidenceDecision(d, { ...session.bundle, sources: group }));
            decisions.push(...decision);
          }
          const disputed: string[] = [];
          for (const decision of decisions) {
            const defect = canonical.find(d => d.id === decision.id)!;
            if (decision.disposition === "supported-defect") Object.assign(defect, bindScientificAuthority(defect, decision, context, sources));
            else disputed.push(defect.id);
          }
          defects = defects.map(d => canonical.find(c => c.id === d.id)!);
          for (const obligation of unresolved) Object.assign(obligation, canonical.find(c => c.id === obligation.id)!);
          const supported = canonical.filter(d => d.category !== "invalid-patch" && !disputed.includes(d.id));
          const unsupported = decisions.filter(d => d.disposition === "unsupported-review-demand");
          const freshAdjudications = unsupported.flatMap(decision => {
            const defect = canonical.find(d => d.id === decision.id)!;
            const bound = { ...defect, sourceIds: [...new Set([...defect.sourceIds, ...decision.support.map(s => s.sourceId)])].sort() };
            const current = context.adjudications?.some(a => a.defect.id === defect.id && a.candidate === context.fingerprint && a.binding === context.binding && defectScope(a.defect) === defectScope(bound));
            return current ? [] : [{ defect: bound, candidate: context.fingerprint, binding: context.binding!, rationale: decision.rationale, support: decision.support }];
          });
          if (freshAdjudications.length) {
            // A source-proven unsupported demand still requires an independent fresh review.
            // Preserve supported old/new obligations and their authority through that refresh.
            return { defects: defects.filter(d => !disputed.includes(d.id)), verified: [], complete: false, refresh: true, adjudications: freshAdjudications };
          }
          if (disputed.length && !supported.length) {
            const missing = decisions.some(d => d.disposition === "insufficient-evidence" || d.disposition === "unresolved-source-conflict");
            if (missing && session.passes < 2) {
              session.bundle = { ...session.bundle, sources: focused };
              await session.enrich(call, canonical.filter(d => disputed.includes(d.id)), candidate, context, teaching, async passes => { enrichments[stage] = passes; await saveRun(); if (latestState) await checkpoint(latestState); });
              focused = session.bundle.sources; sources = [...new Map([...sources, ...focused].map(s => [s.id, s])).values()]; enrichments[stage] = session.passes; binding.sources = fingerprint(sources); schema = z.object({ content: shape() });
              return { defects, verified: [], complete: false, refresh: true };
            }
            const message = unsupported.length && !missing ? "Fresh review still disputes the exact source adjudication" : "Component has unresolved source disputes";
            throw new RepairFailure("content", message, canonical.map(d => ({ ...d, status: disputed.includes(d.id) ? "disputed" : "open", occurrences: context.obligations.find(o => o.id === d.id)?.occurrences ?? 1 })), context.round);
          }
          await reviewRecord(`reviews-${context.round}`, { technical, visual, decisions }, canonical, disputed);
          return { defects, verified, disputedIds: disputed, complete: technical.approved && visual.approved && !deterministic.length };
        },
        edit: async (candidate, targets, defects, context) => {
          const proofIds = [...new Set(defects.flatMap(d => d.sourceProof?.support.map(s => s.sourceId) ?? d.sourceIds))];
          if (proofIds.length > 14) throw new RepairFailure("content", "Edit dependencies exceed focused evidence bound");
          focused = [...new Set([...proofIds, ...focused.map(s => s.id)])].slice(0, 14).map(id => sources.find(s => s.id === id)!);
          const patch = await requestEdit(call, candidate, targets, defects, context, sourceText(), sources);
          return patch;
        },
        auditPatch: async (before, after, targets, context) => {
          const proof = passageSelection(focused);
          const intersects=(a:string,b:string)=>a===b||a.startsWith(b+"/")||b.startsWith(a+"/");
          const obligations=context.obligations.filter(d=>d.category!=="invalid-patch"&&d.status!=="disputed"&&targets.some(t=>d.targets.some(p=>intersects(p,t.path))||(d.artifact&&intersects(d.artifact,t.path))));
          if(!obligations.length)throw new RepairFailure("schema","Patch has no bound repair obligation");
          const audit = await call("Audit ONLY the proposed edits and their dependencies against primary evidence. Check changed equations, examples, symbols, null/empty branches, disclosures and all quiz answer dependencies. Reject new scientific errors or lost essential requirements. Existing unrelated defects may remain private; they cannot excuse a new error. Return the IDs of targeted obligations demonstrably corrected by this patch. At least ONE real obligation must be corrected; other existing findings may remain open if no new error or broken dependency is introduced. Do not reject private progress solely because another existing finding remains. Unrelated native fields must remain byte-identical. Wording inside an explicitly targeted text field may change while all unaffected claims keep their meaning. If replacing an owning array, preserve unrelated entries and fields exactly.\n" + JSON.stringify({ before, after, targets: targets.map(t => t.path), obligations, teaching }) + "\nEVIDENCE:\n" + passageSourceText(sourceText()), z.object({ resolvedDefectIds: z.array(z.enum(obligations.map(d=>d.id) as [string,...string[]])).max(obligations.length), noNewDefects: z.boolean(), unrelatedUnchanged: z.boolean(), dependenciesConsistent: z.boolean(), passageIds: proof.ids, reason: z.string().max(2000) }), `patch-audit-${context.round}`);
          if (!audit.resolvedDefectIds.length || !audit.noNewDefects || !audit.unrelatedUnchanged || !audit.dependenciesConsistent) throw new RepairFailure("content", audit.reason);
        },
        replan: async (candidate, defects, context) => {
          fallbacks[stage] = true; await saveRun();
          const target = context.catalog.find(t => t.path === "/content");
          const targetSchema = shape();
          const targets = [{ path: "/content", value: candidate.content, schema: targetSchema, fingerprint: fingerprint(candidate.content), constraints: z.toJSONSchema(targetSchema) }];
          if (id === "explanation" || id === "quiz") throw new RepairFailure("content", "Text components require targeted edits");
          return { targets, patch: await requestEdit(call, candidate, targets, defects, context, sourceText() + "\nUse ONE narrower source-supported representation that satisfies the same teaching requirement. Preserve stable figure identity.\n" + kitCapabilities, sources) };
        },
      });
      spent = outcome.rounds - startRound;
      const content = outcome.candidate.content;
      const publication: ComponentPublication = { completionId: fingerprint([parentBinding, content, sources]).slice(0, 64), id, expectedRevision: paperKit(paper).components.find(c => c.id === id)?.revision ?? null, dependencies, sources, scope: bundle.scope, content, review: { version: 1, contentDigest: digest(content), sourcesDigest: digest(sources), implementationDigest: runtime.implementationDigest, gates: allGates } };
      await componentRecord("approved", publication);
      await runtime.progress("publishing");
      const { revision } = await runtime.publish(publication);
      const kit = paperKit(paper); kit.components = [...kit.components.filter(c => c.id !== id), { id, state: "ready", revision, dependencies, sourceIds: sources.map(s => s.id) }]; paper.kit = kit;
      if (id === "explanation") paper.recall = content as any;
      else if (id === "diagram") paper.scene = prepareScene(content as any);
      else { paper.study ??= { figures: [], quiz: [] }; if (id === "quiz") paper.study.quiz = content as any; else paper.study.figures = [...paper.study.figures.filter(f => `figure:${f.id}` !== id), content as any]; }
      outcomes.push({ id, status: "passed", rounds: spent });
      run.completed.push(id); run.completedRevisions[id] = revision; await saveRun();
    } catch (error) {
      if (error instanceof z.ZodError) error = new RepairFailure("schema", error.message);
      if (error instanceof RepairFailure) spent = Math.max(spent, (error.rounds ?? startRound) - startRound);
      const publicationAccepted = outcomes.some(outcome => outcome.id === id && outcome.status === "passed");
      if (!publicationAccepted) outcomes.push({ id, status: "failed", owner: error instanceof RepairFailure ? error.owner : "execution", rounds: spent });
      await failureCheckpoint?.();
      await componentRecord("failure", { owner: error instanceof RepairFailure ? error.owner : "execution", reason: error instanceof Error ? error.message : "Unknown failure", ledger: error instanceof RepairFailure ? error.ledger : [], rounds: spent, publicationAccepted });
      if (!publicationAccepted) await status(id, "failed");
      // Independent components remain eligible after a scientific rejection; execution interruption stops the run.
      if (!(error instanceof RepairFailure) || error.owner === "execution") throw error;
    } finally { budgets[stage] = Math.max(0, budgets[stage] - spent); run.used[stage] = usedBefore + spent; await saveRun(); }
  }
  return await terminal();
  } catch (error) {
    const failure = error instanceof RepairFailure ? error : new RepairFailure(error instanceof z.ZodError ? "schema" : "execution", error instanceof Error ? error.message : "Unknown execution failure");
    throw new KitFailure(failure, await terminal(failure));
  }
}
