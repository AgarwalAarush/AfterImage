import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { researchFromHtml } from "../src/lib/source-extraction";
import { abstractResearch, researchPaperId, researchText, type ResearchBundle } from "../src/lib/research-bundle";
import { validateEvidenceDecision, selectEvidence, EvidenceSession, reconcileEvidence, referencedSourceIds, sourcePassages, passageSelection, validateScientificAuthority, bindScientificAuthority, evidenceDecisionDigest } from "../worker/evidence";
import { repairCandidate, fingerprint, defectScope, RepairFailure, type RepairDefect, type RepairContext, type Target } from "../worker/repair-controller";
import { auditEquationPatch, targetingPrompt, reviewTargets, reviewCitations, requestEdit, type Model } from "../worker/repair-model";
import type { Paper } from "../src/lib/types";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/triroute-evidence.json", import.meta.url), "utf8"));
const paper = { arxivId: "2607.06601v1", sources: [{ id: "abstract", label: "Abstract", url: "https://arxiv.org/abs/2607.06601v1", excerpt: "Three coupled routing axes." }] } as Paper;
const bundle = researchFromHtml(paper, fixture.html);
const excerpt = "ffn  = gates[..., 1:].sum(-1) * (3.0 * cfg.d_model * cfg.d_ff)   # null is free";
const defect: RepairDefect = { id: "null", owner: "content", category: "incorrect-notation", targets: ["/recall/equations/2/latex"], sourceIds: [], evidence: "Uniform expert cost incorrectly includes null expert 0.", acceptance: "Zero FFN-expert cost for null, retaining original selected weights." };
const context: RepairContext = { round: 0, fingerprint: fingerprint(fixture.candidate), binding: "a".repeat(64), obligations: [], catalog: [] };

test("frozen rejected TriRoute candidate exposes the null-cost error and Appendix C reaches reviewers", async () => {
  assert.match(fixture.candidate.recall.equations[2].latex, /\\sum_\{j\\in\\mathcal S/);
  assert.ok(bundle.sources.find(s => s.id === "appendix-a3")!.excerpt.includes(excerpt));
  await reconcileEvidence(async (prompt, schema) => {
    assert.ok(prompt.includes(excerpt));
    assert.ok(prompt.includes("coverage"));
    return schema.parse({ candidate: context.fingerprint, binding: context.binding, decisions: [{ id: defect.id, disposition: "supported-defect", rationale: "Appendix C excludes null without renormalizing.", passageIds: [sourcePassages(bundle.sources).find(p => p.passage.includes(excerpt))!.id], requirement: "Null-only selected gate yields zero expert work." }] });
  }, [defect], fixture.candidate, context, bundle, "TriRoute", {});
  // Evaluate the attributed mathematical reformulation, never execute the downloaded listing.
  const cost = (selectedWeights: number[], realExpertCost: number) => selectedWeights.slice(1).reduce((a, b) => a + b, 0) * realExpertCost;
  assert.equal(cost([1, 0, 0], 120), 0);
  assert.equal(cost([0, 1, 0], 120), 120);
  assert.equal(cost([0.25, 0.75, 0], 120), 90);
});

test("scientific dispositions reject missing, invented and inexact source proof", () => {
  const decision = { id: "null", disposition: "supported-defect" as const, rationale: "Wrong cost", support: [{ sourceId: "appendix-a3", passage: excerpt }], requirement: "Zero null FFN work" };
  validateEvidenceDecision(decision, bundle);
  assert.throws(() => validateEvidenceDecision({ ...decision, support: [] }, bundle), /lacks supporting/);
  assert.throws(() => validateEvidenceDecision({ ...decision, support: [{ sourceId: "invented", passage: excerpt }] }, bundle), /inexact/);
  assert.throws(() => validateEvidenceDecision({ ...decision, support: [{ sourceId: "appendix-a3", passage: "The null cost is one million." }] }, bundle), /inexact/);
  assert.throws(() => validateEvidenceDecision({ ...decision, disposition: "unsupported-review-demand", support: [] }, bundle), /lacks supporting/);
});

function manySources(): ResearchBundle {
  const catalogue = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, label: `Section ${i}`, excerpt: `Evidence ${i}`, url: `https://arxiv.org/html/2607.06601v1#S${i}` }));
  return { ...abstractResearch([]), scope: "full-text", catalogue, sources: catalogue.slice(0, 14) };
}
test("bounded enrichment preserves pinned sources and cannot replace cited evidence", async () => {
  const data = manySources();
  const pins = referencedSourceIds({ recall: { sourceIds: ["s0"], equations: [{ sourceId: "s1" }] } }, { sourceIds: ["s2"] });
  const chosen = selectEvidence(data, ["s19"], pins);
  assert.equal(chosen.sources.length, 14);
  assert.ok(["s0", "s1", "s2", "s19"].every(id => chosen.sources.some(s => s.id === id)));
  const focused = selectEvidence(data, ["s19"], new Set(data.sources.map(s => s.id)));
  assert.ok(focused.sources.some(s => s.id === "s19"));
  assert.equal(focused.sources.length, 14);
  assert.deepEqual(focused.catalogue, data.catalogue);
  assert.throws(() => selectEvidence(data, ["http://other-paper"], pins), /Invalid bounded/);
  const session = new EvidenceSession(data, "Paper");
  const model: Model = async (_, schema, name) => schema.parse({ candidate: context.fingerprint, binding: context.binding, sourceIds: [name.endsWith("-0") ? "s19" : "s18"] });
  await session.enrich(model, [], {}, context, {});
  await session.enrich(model, [], {}, context, {});
  await assert.rejects(session.enrich(model, [], {}, context, {}), /enrichment exhausted/);
});

test("research identity preserves version and rejects arbitrary locations", () => {
  assert.equal(researchPaperId("2607.06601v1"), "2607.06601v1");
  assert.throws(() => researchPaperId("https://example.com/paper"));
  assert.throws(() => researchFromHtml(paper, '<a href="/abs/2607.06601v2">New version</a>'));
});

const schema = z.object({ text: z.string(), sourceId: z.enum(["s0"]) });
const initial = { text: "Supported text", sourceId: "s0" as const };
const demand: RepairDefect = { ...defect, id: "optional", targets: ["/text"], sourceIds: ["s0"] };
const record = async () => {};
test("an unsupported demand requires a receipt and fresh passing review without an edit", async () => {
  let reviews = 0;
  const result = await repairCandidate(initial, { schema, maxRepairs: 0, record, validate: () => {},
    review: async (_, ctx) => {
      reviews++;
      if (!ctx.adjudications?.length) return { defects: [], complete: false, refresh: true, verified: [], adjudications: [{ defect: demand, candidate: ctx.fingerprint, binding: ctx.binding!, rationale: "The source supports the unchanged statement.", support: [{ sourceId: "s0", passage: "Supported text" }] }] };
      assert.ok(targetingPrompt(ctx).includes("Supported text"));
      return { defects: [], complete: true, verified: ctx.obligations.map(d => ({ id: d.id, resolved: true, resolution: "adjudication", evidence: "Fresh source and visual reviews pass the unchanged text." })) };
    }, edit: async () => { throw new Error("Must not edit"); }, replan: async () => { throw new Error("Must not replan"); } });
  assert.equal(reviews, 2); assert.equal(result.rounds, 0); assert.deepEqual(result.candidate, initial);
  assert.equal(result.ledger[0].status, "resolved");
});
test("adjudication cannot use a stale receipt or close a still-blocking fresh finding", async () => {
  for (const stale of [true, false]) {
    await assert.rejects(repairCandidate(initial, { schema, maxRepairs: 0, record, validate: () => {},
      review: async (_, ctx) => !ctx.adjudications?.length ? { defects: [], complete: false, refresh: true, verified: [], adjudications: [{ defect: demand, candidate: stale ? "old" : ctx.fingerprint, binding: ctx.binding!, rationale: "Proof", support: [{ sourceId: "s0", passage: "Supported text" }] }] }
        : { defects: [demand], complete: true, verified: [{ id: demand.id, resolved: true, resolution: "adjudication", evidence: "Claimed resolved" }] },
      edit: async () => ({}), replan: async () => { throw new Error("Unexpected"); } }), /Invalid adjudication|passing fresh review/);
  }
});
test("source refresh changes bindings and schemas without consuming an edit", async () => {
  let refreshed = false; const binding = { sourceEpoch: 0 }; const bindings: string[] = [];
  const result = await repairCandidate(initial, { schema: () => z.object({ text: z.string(), sourceId: refreshed ? z.enum(["s0", "s19"]) : z.enum(["s0"]) }), binding, maxRepairs: 0, record, validate: () => {},
    review: async (_, ctx) => { bindings.push(ctx.binding!); if (!refreshed) { refreshed = true; binding.sourceEpoch++; return { defects: [], verified: [], complete: false, refresh: true }; } return { defects: [], verified: [], complete: true }; },
    edit: async () => { throw new Error("Unexpected edit"); }, replan: async () => { throw new Error("Unexpected replan"); } });
  assert.notEqual(bindings[0], bindings[1]); assert.equal(result.rounds, 0);
});
test("source refresh cannot discard a genuine finding when a fresh reviewer omits it", async () => {
  let refreshed = false;
  await assert.rejects(repairCandidate(initial, { schema, maxRepairs: 0, record, validate: () => {},
    review: async (_, ctx) => {
      if (!refreshed) { refreshed = true; return { defects: [demand], complete: false, refresh: true, verified: [] }; }
      assert.equal(ctx.obligations[0].id, demand.id);
      return { defects: [], complete: true, verified: [] };
    }, edit: async () => { throw new Error("Unexpected"); }, replan: async () => { throw new Error("Unexpected"); } }),
  (error: unknown) => error instanceof RepairFailure && error.ledger.some(d => d.id === demand.id && d.status === "disputed"));
});
test("scientific edit authority binds exact passages to the current active sources", () => {
  const supported = { ...defect, sourceIds: ["appendix-a3"], sourceProof: { version:1 as const, candidate:context.fingerprint, binding:context.binding!, scope:defectScope({...defect,sourceIds:["appendix-a3"]}), decision:evidenceDecisionDigest({id:defect.id,disposition:"supported-defect",requirement:defect.acceptance,support:[{sourceId:"appendix-a3",passage:excerpt}]}), sourceIds:bundle.sources.map(s=>s.id), sources: fingerprint(bundle.sources), support: [{ sourceId: "appendix-a3", passage: excerpt }], requirement: defect.acceptance } };
  validateScientificAuthority([supported], bundle.sources, context);
  assert.throws(() => validateScientificAuthority([defect], bundle.sources, context), /lacks current/);
  assert.throws(() => validateScientificAuthority([supported], bundle.sources.map(s=>({...s,excerpt:s.excerpt+" Changed evidence."})), context), /lacks current/);
  assert.throws(() => validateScientificAuthority([{ ...supported, sourceIds: [] }], bundle.sources, context), /not cited|scope/);
  assert.throws(() => validateScientificAuthority([{ ...defect, owner: "representation" }], bundle.sources, context), /lacks current/);
});

test("audit citation IDs derive from received passages rather than a second model citation list", () => {
  const selection = passageSelection(bundle.sources);
  const chosen = selection.passages.find(p => p.passage.includes(excerpt))!;
  const proof = selection.proof([chosen.id]);
  assert.deepEqual(proof.sourceIds, ["appendix-a3"]);
  assert.equal(proof.sourceSupport[0].passage, chosen.passage);
  assert.throws(() => selection.proof(["invented-passage"]), /Unknown supporting/);
});

test("scientific authority cannot be bypassed by alternate numeric finding labels", () => {
  for (const category of ["unsupported_diagram_value", "unsupported-diagram-value", "widget-review"]) {
    assert.throws(() => validateScientificAuthority([{ ...defect, category, evidence: "The quantitative gauge value 0.5 is unsupported." }], bundle.sources), /lacks current source authority/);
  }
});
test("unsupported mathematical proposals never replace the prior candidate", async () => {
  const snapshots: string[] = [];
  await assert.rejects(repairCandidate(initial, { schema, maxRepairs: 1, record, validate: () => {},
    review: async (candidate, ctx) => { snapshots.push(candidate.text); return { defects: [demand], verified: ctx.obligations.map(d => ({ id: d.id, resolved: false, evidence: "Still wrong" })), complete: true }; },
    edit: async (candidate, targets) => ({ base: fingerprint(candidate), preimages: { t0: targets[0].fingerprint }, changes: { t0: "Unsupported new equation" } }),
    auditPatch: async () => { throw new RepairFailure("content", "Proposed math has no source support"); }, replan: async () => { throw new Error("Unexpected"); } }), /budget exhausted/);
  assert.deepEqual(snapshots, [initial.text, initial.text]);
});
test("equation pre-adoption audits check fingerprints and exact source passages", async () => {
  const proposed = structuredClone(fixture.candidate); proposed.recall.equations[2].explanation += " Null is excluded per Appendix C.";
  const model: Model = async (_, output) => output.parse({ candidate: fingerprint(proposed), binding: context.binding, audits: [{ index: 2, fingerprint: fingerprint(proposed.recall.equations[2]), origin: "derived", definitionEvidence: "The null branch is free.", sourceIds: ["appendix-a3"], passageIds: ["invented-passage"], symbols: [{ symbol: "gates", definition: "Selected weights", resultPassage: "Null is excluded" }], verdict: "pass", repair: "", targets: [], owner: null, acceptance: null, artifact: null }] });
  await assert.rejects(auditEquationPatch(model, fixture.candidate, proposed, [] as Target[], context, researchText(bundle, "TriRoute")), /Invalid option|exact source proof/);
});

test("review target schemas allow only native catalog fields, including an empty catalog", () => {
  const leaf = "/recall/equations/2/latex";
  const output = reviewTargets({ ...context, catalog: [{ path: leaf, schema: z.string(), value: "x", fingerprint: fingerprint("x"), constraints: {} }] });
  assert.deepEqual(output.parse([leaf]), [leaf]);
  assert.throws(() => output.parse(["/recall/equations/2"]));
  assert.deepEqual(reviewTargets(context).parse([]), []);
  assert.throws(() => reviewTargets(context).parse([leaf]));
});

test("review citation schemas refresh excerpt IDs and reject passage IDs or invented citations", () => {
  const old = reviewCitations(["s0"]), refreshed = reviewCitations(["s0", "appendix-a3"]);
  assert.throws(() => old.parse(["appendix-a3"]));
  assert.deepEqual(refreshed.parse(["appendix-a3"]), ["appendix-a3"]);
  assert.throws(() => refreshed.parse(["appendix-a3:invented-passage"]));
  assert.throws(() => refreshed.parse(["another-paper"]));
  assert.deepEqual(refreshed.parse([]), []);
});

test("initial evidence failures retain structured findings in the private ledger", async () => {
  await assert.rejects(repairCandidate(initial, { schema, maxRepairs: 0, record, validate: () => {},
    review: async () => { throw new RepairFailure("content", "Unresolved source conflict", [{ ...demand, status: "disputed", occurrences: 1 }]); },
    edit: async () => { throw new Error("Unexpected edit"); }, replan: async () => { throw new Error("Unexpected replan"); } }),
  (error: unknown) => error instanceof RepairFailure && error.rounds === 0 && error.ledger[0]?.id === demand.id && error.ledger[0]?.status === "disputed");
});

test("a scientific validation finding can acquire evidence authority before its native edit", async () => {
  const candidate = { cost: 120, sourceId: "appendix-a3", unaffected: "Keep this explanation" };
  const output = z.object({ cost: z.number().nonnegative(), sourceId: z.literal("appendix-a3"), unaffected: z.string() });
  const located: RepairDefect = { ...defect, targets: ["/cost"], sourceIds: ["appendix-a3"] };
  const model: Model = async (_, schema, name) => {
    if (name.startsWith("evidence-")) return schema.parse({ candidate: fingerprint(candidate), binding: fingerprint({ candidate: fingerprint(candidate), inputs: undefined }), decisions: [{ id: located.id, disposition: "supported-defect", rationale: "Appendix C says null is free.", requirement: "A null-only selection has zero FFN-expert cost.", passageIds: [sourcePassages(bundle.sources).find(p => p.passage.includes(excerpt))!.id] }] });
    assert.equal(name, "edit-0");
    return schema.parse({ base: fingerprint(candidate), preimages: { t0: fingerprint(120) }, changes: { t0: 0 } });
  };
  const result = await repairCandidate(candidate, { schema: output, maxRepairs: 1, record, validate: c => assert.equal(c.cost, 0),
    review: async (c, ctx) => {
      if (c.cost === 0) return { defects: [], complete: true, verified: ctx.obligations.map(d => ({ id: d.id, resolved: true, evidence: "Zero cost agrees with the selected null branch in Appendix C." })) };
      const [decision] = await reconcileEvidence(model, [located], c, ctx, bundle, "TriRoute", {});
      return { defects: [bindScientificAuthority(located,decision,ctx,bundle.sources)], verified: [], complete: false };
    }, edit: (c, targets, defects, ctx) => requestEdit(model, c, targets, defects, ctx, researchText(bundle, "TriRoute")),
    replan: async () => { throw new Error("No representation replan needed"); } });
  assert.equal(result.candidate.cost, 0);
  assert.equal(result.candidate.unaffected, candidate.unaffected);
  assert.equal(result.rounds, 1);
});
test('bounded evidence selection previews expose implementation endings',async()=>{
 const {cataloguePreview}=await import('../worker/evidence');
 const text='Reference implementation\n'+'controller trunk details '.repeat(150)+'\n'+excerpt+'\nreturn attn + ffn, mem';
 const preview=cataloguePreview(text);
 assert.ok(preview.length<=1600);assert.match(preview,/Reference implementation/);assert.ok(preview.includes(excerpt));assert.match(preview,/middle omitted/);
 assert.equal(cataloguePreview('short exact excerpt'),'short exact excerpt');
 assert.equal(text.endsWith('return attn + ffn, mem'),true);
});
test('controller patch diagnostics do not create new scientific obligations',async()=>{
 const {scientificFinding}=await import('../worker/evidence');
 const diagnostic={...defect,id:'invalid-patch',category:'invalid-patch',owner:'schema' as const,evidence:'The source equation edit rewrote an unrelated field.',sourceIds:[]};
 assert.equal(scientificFinding(diagnostic),false);
 assert.equal(scientificFinding({...diagnostic,id:'reviewer-demand'}),true);
 assert.throws(()=>validateScientificAuthority([defect,diagnostic],bundle.sources),/source authority/);
});
