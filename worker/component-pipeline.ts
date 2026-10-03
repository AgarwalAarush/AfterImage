import { candidateSchema, textBoundFindings } from "./text-bounds";
import { z } from "zod";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Paper, Source } from "../src/lib/types";
import { paperKit, projectPublishedPaper, componentIdSchema } from "../src/lib/kit";
import { digest, type ComponentPublication } from "../src/lib/kit-publication";
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
import { repairCandidate, RepairFailure, fingerprint, targetCatalog, applyPatch, patchSchema, type RepairContext, type RepairDefect, type RepairCheckpoint } from "./repair-controller";
import { requestEdit, verifyObligations, reconcileDefectIdentities, assessRepresentationEdits, reviewTargets, reviewCitations, targetingPrompt, type Model } from "./repair-model";
import { cataloguePreview, passageSelection, passageSourceText, referencedSourceIds, reconcileEvidence, validateEvidenceDecision, EvidenceSession } from "./evidence";
import { KitCheckpoints } from "./kit-checkpoint";

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
  implementationDigest: string; runId: string; assertLease?: () => Promise<void>;
};
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
  await runtime.progress("sources");
  let bundle = registry(runtime.research ?? await researchSources(paper));
  await record("research", bundle);
  const checkpoints = new KitCheckpoints(runtime.checkpointRoot, paper.id, runtime.assertLease);
  const outcomes: { id: string; status: string; owner?: string; rounds?: number }[] = [];
  const runBinding = fingerprint([runtime.runId, runtime.implementationDigest]);
  const previousRun = await checkpoints.read("run", runBinding);
  const run = (previousRun?.candidate ?? { used: { opening: 0, supplement: 0 }, fallbacks: { opening: false, supplement: false }, enrichments: { opening: 0, supplement: 0 }, completed: [] }) as { used: { opening: number; supplement: number }; fallbacks: { opening: boolean; supplement: boolean }; enrichments: { opening: number; supplement: number }; completed: string[] };
  const saveRun = () => checkpoints.write({ version: 1, binding: runBinding, componentId: "run", candidate: run });
  const budgets = { opening: Math.max(0, 4 - run.used.opening), supplement: Math.max(0, 2 - run.used.supplement) }, fallbacks = run.fallbacks, enrichments = run.enrichments;
  const citation = z.enum(bundle.catalogue.map(s => s.id) as [string, ...string[]]);
  await runtime.progress("planning");
  const planBinding = fingerprint([pipelineVersion, runtime.implementationDigest, bundle.catalogue, paper.id]);
  const savedPlan = await checkpoints.read("plan", planBinding);
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
  const ids = runtime.target ? [componentIdSchema.parse(runtime.target)] : [...(runtime.studyOnly ? [] : ["explanation", "diagram"]), ...plan.figures.map(f => `figure:${f.id}`), "quiz"];
  for (const id of ids.filter(id => !run.completed.includes(id))) await runtime.status(id, "pending");
  for (const id of ids) {
    if (run.completed.includes(id)) { outcomes.push({ id, status: "passed" }); continue; }
    const stage = ["explanation", "diagram"].includes(id) ? "opening" : "supplement";
    if (id !== "explanation" && !paper.recall) { await runtime.status(id, "blocked"); outcomes.push({ id, status: "blocked" }); continue; }
    const dependencies: Record<string, string> = id === "explanation" ? {} : { explanation: paperKit(paper).components.find(c => c.id === "explanation")!.revision! };
    const parentBinding = fingerprint([planBinding, id, dependencies]);
    const componentDir = path.join(dir, id.replace(":", "-")); await mkdir(componentDir, { recursive: true });
    const componentRecord = (name: string, value: unknown) => writeFile(path.join(componentDir, `${name}.json`), JSON.stringify(value, null, 2));
    const call: Model = (prompt, schema, name, images) => model(prompt, schema, `${id.replace(":", "-")}-${name}`, images);
    let spent = 0, startRound = 0;
    const usedBefore = run.used[stage];
    try {
      await runtime.status(id, "running");
      const purpose = id.startsWith("figure:") ? plan.figures.find(f => `figure:${f.id}` === id)?.question ?? paper.study?.figures.find(f => `figure:${f.id}` === id)?.title : id === "diagram" ? plan.diagram.proof : plan.requirements.join("\n");
      const selected = await call("Select the minimum primary evidence needed to generate and review this component, including relevant appendices, equations and reported conditions. Include corresponding same-version implementation listings for algorithm/cost claims; inspect exceptional, null and empty branches rather than relying on the main-text formula alone. Return catalogue IDs only.\nCOMPONENT:\n" + JSON.stringify({ id, purpose, plan }) + "\nCATALOGUE:\n" + JSON.stringify(bundle.catalogue.map(s => ({ id: s.id, label: s.label, preview: cataloguePreview(s.excerpt) }))), z.object({ sourceIds: z.array(citation).min(1).max(14) }), "select-sources");
      const saved = await checkpoints.read(id, parentBinding);
      let sources = saved?.sources ?? bundle.catalogue.filter(s => selected.sourceIds.includes(s.id));
      let focused = sources.slice(0, 14);
      const evidenceCache = new Map<string, Awaited<ReturnType<typeof reconcileEvidence>>>(saved?.evidenceDecisions as [string, Awaited<ReturnType<typeof reconcileEvidence>>][] ?? []);
      const session = new EvidenceSession({ ...bundle, sources: focused }, paper.title); session.passes = enrichments[stage];
      const shape = () => id === "explanation" ? generationSchemas(sources.map(s => s.id)).recall : id === "diagram" ? generationSchemas(sources.map(s => s.id)).scene : id === "quiz" ? studySchema.shape.quiz.min(2) : figureSchema;
      let schema = z.object({ content: shape() });
      const binding: Record<string, unknown> = { version: pipelineVersion, implementation: runtime.implementationDigest, parent: parentBinding, sources: fingerprint(focused), plan: fingerprint(plan) };
      const sourceText = () => JSON.stringify({ title: paper.title, scope: bundle.scope, sources: focused });
      const baseline = saved?.candidate ?? (id === "explanation" ? runtime.initial?.recall : id === "diagram" ? runtime.initial?.scene : id === "quiz" ? runtime.initial?.study?.quiz : runtime.initial?.study?.figures.find((f: any) => `figure:${f.id}` === id));
      await runtime.progress("drafting");
      const instruction = "Create only the named component, with complete sentences and exact source citations. Teach the frozen plan's essential requirements without adding optional scope. Equations use KaTeX and define every symbol, dimension, exceptional/null branch and source-versus-derived origin. Mark invented examples illustrative. Respect native field bounds; never truncate text. The explanation is a substantial 400–600 word technical refresher and must make sense without images. Diagrams supply semantic data only. Study figures use the requested stable ID. Quiz questions and every distractor explanation must be independently answerable from the explanation and primary sources, with no dependence on pending figures. Never refer to unavailable diagrams.\n";
      const remapCitations = (value: any): any => Array.isArray(value) ? value.map(remapCitations) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, v]) => [key, key === "sourceId" ? bundle.catalogue.find(s => s.id.replace(/:[a-f0-9]{16}$/, "") === v)?.id ?? v : key === "sourceIds" && Array.isArray(v) ? v.map(id => bundle.catalogue.find(s => s.id.replace(/:[a-f0-9]{16}$/, "") === id)?.id ?? id) : remapCitations(v)])) : value;
      if (baseline && !saved) { const ids = referencedSourceIds(remapCitations(baseline)); sources = [...new Map([...sources, ...bundle.catalogue.filter(s => ids.has(s.id))].map(s => [s.id, s])).values()]; schema = z.object({ content: shape() }); }
      let initial = baseline ? candidateSchema(schema).parse(saved?.candidate ?? { content: remapCitations(baseline) }) : await call(instruction + kitCapabilities + "\nCOMPONENT:\n" + JSON.stringify({ id, purpose, plan, explanation: id === "explanation" ? undefined : paper.recall }) + "\nPRIMARY EVIDENCE:\n" + sourceText(), schema, "draft");
      if (id.startsWith("figure:") && (initial.content as any).id !== id.slice(7)) throw new RepairFailure("schema", "Draft changed figure identity");
      const inspect = (candidate: typeof initial) => [...new Map([...textBoundFindings(candidate, schema), ...componentValidation(id, candidate.content, sources)].map(f=>[`${f.objectId}:${f.invariant}`,f])).values()];
      const validate = (candidate: typeof initial) => { const issues = inspect(candidate); if (issues.length) throw new Error(issues.map(f => `${f.objectId}: ${f.message}`).join("; ")); };
      startRound = previousRun && saved?.repair ? saved.repair.round : 0;
      const checkpoint = async (state: RepairCheckpoint<typeof initial>) => {
        spent = state.round - startRound;
        run.used[stage] = usedBefore + spent; await saveRun();
        await checkpoints.write({ version: 1, binding: parentBinding, componentId: id, candidate: state.candidate, repair: state, sources, evidenceDecisions: [...evidenceCache.entries()].slice(-64), exhausted: spent >= budgets[stage] });
      };
      const outcome = await repairCandidate(initial, {
        schema: () => schema, binding, maxRepairs: budgets[stage] + startRound, replanAvailable: !fallbacks[stage], allowRepresentationFallback: id !== "explanation" && id !== "quiz", inspect, validate,
        // Resume the candidate; an explicitly requested retry gets a fresh bounded stage budget.
        resume: saved?.repair ? { ...saved.repair, round: startRound, replanned: fallbacks[stage], seen: previousRun ? saved.repair.seen : [] } as RepairCheckpoint<typeof initial> : undefined,
        checkpoint,
        record: async (name, value) => { if (name.startsWith("replan-")) { fallbacks[stage] = true; await saveRun(); } await componentRecord(name, value); },
        review: async (candidate, context) => {
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
          const findingSchema = z.object({ invariant: z.string().min(3).max(160), objectId: z.string().min(1).max(160), owner: z.enum(["content", "representation", "renderer", "schema"]), targets: reviewTargets(context), evidence: z.string().min(1).max(2000), acceptance: z.string().min(1).max(2000), sourceIds: reviewCitations(focused.map(s => s.id)) });
          const reviewSchema = z.object({ approved: z.boolean(), findings: z.array(findingSchema).max(20), equationAudits: z.array(z.object({ index: z.number().int().min(0).max(4), fingerprint: z.string().length(64), passed: z.boolean(), passageIds: proof.ids })).max(5) });
          const equationList = id === "explanation" ? ((candidate.content as any).equations ?? []).map((eq: unknown, index: number) => ({ index, fingerprint: fingerprint(eq), equation: eq })) : [];
          const common = targetingPrompt(context) + "\nCOMPONENT:\n" + JSON.stringify({ id, candidate, plan, dependencies, explanation: id === "explanation" ? undefined : paper.recall, equations: equationList, deterministic }) + "\nPRIMARY EVIDENCE:\n" + passageSourceText(sourceText());
          const technicalReviews = [];
          const reviewGroups = Array.from({ length: Math.ceil(sources.length / 14) }, (_, i) => sources.slice(i * 14, i * 14 + 14));
          for (const group of reviewGroups) {
          const groupEquations = equationList.filter((a: any) => group.some(s => s.id === a.equation.sourceId));
          const technical = await call("Review only scientific claims whose cited sources are in THIS evidence group. Other source groups receive separate independent reviews; absence from this group is not missing evidence. Audit only the listed group equations. Independently review source support, all mathematics, teaching completeness and dependency independence. Validate every quiz option, correct answer and explanation. For every explanation equation return an audit with the received fingerprint and exact passage IDs; check units, definitions, exceptional branches and derived provenance. Cite only received sources. Do not invent numerical support. Unsupported illustrative values require truthful disclosure, not fabricated attribution. A component must be understandable using ONLY the published explanation and its own text; unavailable figure references are blockers. Report one finding per independently correctable object and invariant. Split missed essential equations or requirements into separate obligations rather than a single blanket completeness demand. Report actionable native fields and stable scientific invariants, preserving the objectId and invariant of an existing obligation when its wording/localization changes. Identify validation dependencies such as parent provenance. Optional teaching expansion is not a defect. Approved requires zero substantive findings.\n" + targetingPrompt(context) + "\nCOMPONENT:\n" + JSON.stringify({ id, candidate, plan, dependencies, equations: groupEquations, deterministic, explanation: id === "explanation" ? undefined : paper.recall }) + "\nPRIMARY EVIDENCE:\n" + passageSourceText(JSON.stringify({ sources: group, title: paper.title })), reviewSchema.extend({ findings: z.array(findingSchema.extend({ sourceIds: reviewCitations(group.map(s => s.id)) })).max(20), equationAudits: z.array(z.object({ index: z.number().int().min(0).max(4), fingerprint: z.string().length(64), passed: z.boolean(), passageIds: passageSelection(group).ids })).length(groupEquations.length) }), `source-review-${context.round}-${fingerprint(group).slice(0, 8)}`);
          if (technical.equationAudits.length !== groupEquations.length || technical.equationAudits.some((a, i) => a.index !== groupEquations[i].index || a.fingerprint !== groupEquations[i].fingerprint)) throw new RepairFailure("schema", "Missing exact equation audit");
          if (technical.equationAudits.some(a => !a.passed) && !technical.findings.length) throw new RepairFailure("schema", "Equation audit rejected without findings");
          technicalReviews.push(technical);
          }
          const technical = { approved: technicalReviews.every(r => r.approved), findings: technicalReviews.flatMap(r => r.findings), equationAudits: technicalReviews.flatMap(r => r.equationAudits) };
          const visual = images.length ? await call("Independently inspect ALL attached rendered views/states. Check actual labels, arrow endpoints, grouping, collisions, units and depicted scientific relationships against sources. Semantic JSON alone cannot establish visual approval. Report exact field targets; use renderer ownership only for a geometry defect native data cannot correct. Never waive a source or geometry failure.\n" + common, reviewSchema.extend({ equationAudits: reviewSchema.shape.equationAudits.max(0) }), `visual-review-${context.round}`, images) : { approved: !deterministic.length, findings: [], equationAudits: [] };
          const nativeBounds = deterministic.filter(f => f.invariant === "native-text-length");
          const raw = [...technical.findings, ...visual.findings].filter(f => !nativeBounds.some(n => f.invariant === n.invariant && f.objectId === n.objectId));
          for (const finding of deterministic.filter(f => f.invariant !== "native-text-length")) {
            if (raw.some(f => f.objectId === finding.objectId && f.invariant === finding.invariant)) continue;
            const geometry = finding.invariant.startsWith("geometry-");
            const targets = geometry ? [] : context.catalog.filter(t => [...finding.paths, ...finding.dependencies].some(p => t.path === p || t.path.startsWith(p + "/"))).filter(t => !context.catalog.some(parent => parent.path !== t.path && t.path.startsWith(parent.path + "/") && [...finding.paths, ...finding.dependencies].includes(parent.path))).slice(0,24).map(t => t.path);
            raw.push({ invariant: finding.invariant, objectId: finding.objectId, owner: geometry ? "renderer" : "content", targets, evidence: finding.message, acceptance: "Correct the named deterministic invariant without changing unrelated content or scientific claims.", sourceIds: focused.map(s => s.id) });
          }
          if ((!technical.approved || !visual.approved) && !raw.length && !nativeBounds.length) throw new RepairFailure("schema", "Rejected review has no actionable finding");
          const newlyNamed: RepairDefect[] = raw.map(f => ({ ...f, id: fingerprint([f.objectId, f.invariant.toLowerCase().replaceAll("_", "-")]).slice(0, 32), category: ((["renderer", "representation"].includes(f.owner) ? "visual-" : "scientific-") + f.invariant).slice(0, 80), artifact: ["renderer", "representation"].includes(f.owner) ? "/content" : undefined }));
          const identified = await reconcileDefectIdentities(call, newlyNamed, candidate, context);
          const defects = await assessRepresentationEdits(call, candidate, identified, context, sourceText()+"\n"+kitCapabilities);
          await componentRecord(`defect-identities-${context.round}`, {candidate:context.fingerprint,findings:newlyNamed,canonical:defects});
          const verified = await verifyObligations(call, candidate, context, sourceText(), images);
          const unresolved = context.obligations.filter(d => !verified.some(v => v.id === d.id && v.resolved));
          // Reconcile supported edits individually so one unrelated dispute cannot stop them.
          const decisions = [];
          for (const defect of [...new Map([...defects, ...unresolved].map(d => [d.id, d])).values()]) {
            const wanted = new Set([...defect.sourceIds, ...focused.map(s => s.id)]);
            const group = [...wanted].slice(0, 14).map(id => sources.find(s => s.id === id)).filter((s): s is Source => !!s);
            const key = fingerprint([candidate, group, plan, defect]);
            let decision = evidenceCache.get(key);
            if (!decision) { decision = await reconcileEvidence(call, [defect], candidate, context, { ...session.bundle, sources: group }, paper.title, plan); evidenceCache.set(key, decision); }
            decision.forEach(d => validateEvidenceDecision(d, { ...session.bundle, sources: group }));
            decisions.push(...decision);
          }
          const disputed: string[] = [];
          for (const decision of decisions) {
            const defect = [...defects, ...unresolved].find(d => d.id === decision.id)!;
            if (decision.disposition === "supported-defect") {
              defect.sourceIds = [...new Set(decision.support.map(s => s.sourceId))];
              defect.sourceProof = { sources: fingerprint(focused), support: decision.support, requirement: decision.requirement };
            } else disputed.push(defect.id);
          }
          if (disputed.length && !defects.some(d => !disputed.includes(d.id))) {
            const missing = decisions.some(d => d.disposition === "insufficient-evidence" || d.disposition === "unresolved-source-conflict");
            if (missing && session.passes < 2) {
              await session.enrich(call, [...defects, ...unresolved].filter(d => disputed.includes(d.id)), candidate, context, plan);
              focused = session.bundle.sources; sources = [...new Map([...sources, ...focused].map(s => [s.id, s])).values()]; enrichments[stage] = session.passes; binding.sources = fingerprint(focused); schema = z.object({ content: shape() });
              return { defects, verified: [], complete: false, refresh: true };
            }
            if (decisions.every(d => d.disposition === "unsupported-review-demand")) {
              if (decisions.some(d => context.adjudications?.some(a => a.defect.id === d.id))) throw new RepairFailure("content", "Fresh review still disputes the exact source adjudication", context.obligations, context.round);
              const adjudications = decisions.map(d => ({ defect: { ...[...defects, ...unresolved].find(f => f.id === d.id)!, sourceIds: [...new Set(d.support.map(s => s.sourceId))] }, candidate: context.fingerprint, binding: context.binding!, rationale: d.rationale, support: d.support }));
              return { defects: defects.filter(d => !disputed.includes(d.id)), verified: [], complete: false, refresh: true, adjudications };
            }
            throw new RepairFailure("content", "Component has unresolved source disputes", [...defects, ...unresolved].map(d => ({ ...d, status: "disputed", occurrences: 1 })), context.round);
          }
          await componentRecord(`reviews-${context.round}`, { technical, visual, decisions });
          return { defects, verified, disputedIds: disputed, complete: technical.approved && visual.approved && !deterministic.length };
        },
        edit: async (candidate, targets, defects, context) => {
          const proofIds = [...new Set(defects.flatMap(d => d.sourceProof?.support.map(s => s.sourceId) ?? d.sourceIds))];
          if (proofIds.length > 14) throw new RepairFailure("content", "Edit dependencies exceed focused evidence bound");
          focused = [...new Set([...proofIds, ...focused.map(s => s.id)])].slice(0, 14).map(id => sources.find(s => s.id === id)!);
          binding.sources = fingerprint(focused);
          for (const defect of defects) if (defect.sourceProof) defect.sourceProof.sources = fingerprint(focused);
          const patch = await requestEdit(call, candidate, targets, defects, context, sourceText());
          return patch;
        },
        auditPatch: async (before, after, targets, context) => {
          const proof = passageSelection(focused);
          const intersects=(a:string,b:string)=>a===b||a.startsWith(b+"/")||b.startsWith(a+"/");
          const obligations=context.obligations.filter(d=>d.category!=="invalid-patch"&&d.status!=="disputed"&&targets.some(t=>d.targets.some(p=>intersects(p,t.path))||(d.artifact&&intersects(d.artifact,t.path))));
          if(!obligations.length)throw new RepairFailure("schema","Patch has no bound repair obligation");
          const audit = await call("Audit ONLY the proposed edits and their dependencies against primary evidence. Check changed equations, examples, symbols, null/empty branches, disclosures and all quiz answer dependencies. Reject new scientific errors or lost essential requirements. Existing unrelated defects may remain private; they cannot excuse a new error. Return the IDs of targeted obligations demonstrably corrected by this patch. At least ONE real obligation must be corrected; other existing findings may remain open if no new error or broken dependency is introduced. Do not reject private progress solely because another existing finding remains. Unrelated native fields must remain byte-identical. Wording inside an explicitly targeted text field may change while all unaffected claims keep their meaning. If replacing an owning array, preserve unrelated entries and fields exactly.\n" + JSON.stringify({ before, after, targets: targets.map(t => t.path), obligations, plan }) + "\nEVIDENCE:\n" + passageSourceText(sourceText()), z.object({ resolvedDefectIds: z.array(z.enum(obligations.map(d=>d.id) as [string,...string[]])).max(obligations.length), noNewDefects: z.boolean(), unrelatedUnchanged: z.boolean(), dependenciesConsistent: z.boolean(), passageIds: proof.ids, reason: z.string().max(2000) }), `patch-audit-${context.round}`);
          if (!audit.resolvedDefectIds.length || !audit.noNewDefects || !audit.unrelatedUnchanged || !audit.dependenciesConsistent) throw new RepairFailure("content", audit.reason);
        },
        replan: async (candidate, defects, context) => {
          fallbacks[stage] = true; await saveRun();
          const target = context.catalog.find(t => t.path === "/content");
          const targetSchema = shape();
          const targets = [{ path: "/content", value: candidate.content, schema: targetSchema, fingerprint: fingerprint(candidate.content), constraints: z.toJSONSchema(targetSchema) }];
          if (id === "explanation" || id === "quiz") throw new RepairFailure("content", "Text components require targeted edits");
          return { targets, patch: await requestEdit(call, candidate, targets, defects, context, sourceText() + "\nUse ONE narrower source-supported representation that satisfies the same teaching requirement. Preserve stable figure identity.\n" + kitCapabilities) };
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
      run.completed.push(id); await saveRun();
      outcomes.push({ id, status: "passed", rounds: spent });
    } catch (error) {
      if (error instanceof z.ZodError) error = new RepairFailure("schema", error.message);
      if (error instanceof RepairFailure) spent = Math.max(spent, (error.rounds ?? startRound) - startRound);
      await componentRecord("failure", { owner: error instanceof RepairFailure ? error.owner : "execution", reason: error instanceof Error ? error.message : "Unknown failure", rounds: spent });
      await runtime.status(id, "failed"); outcomes.push({ id, status: "failed", owner: error instanceof RepairFailure ? error.owner : "execution", rounds: spent });
      // Independent components remain eligible after a scientific rejection; execution interruption stops the run.
      if (!(error instanceof RepairFailure) || error.owner === "execution") throw error;
    } finally { budgets[stage] = Math.max(0, budgets[stage] - spent); run.used[stage] = usedBefore + spent; await saveRun(); }
  }
  await record("kit-quality-report", { version: pipelineVersion, implementationDigest: runtime.implementationDigest, outcomes, budgets, calls: calls.length, elapsedMs: Date.now()-started });
  return { outcomes, paper };
}
