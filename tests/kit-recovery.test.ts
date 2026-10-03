import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import { generateKit, type KitRuntime } from "../worker/component-pipeline";
import { KitCheckpoints, validateKitComponentCheckpoint } from "../worker/kit-checkpoint";
import { repairCandidate, fingerprint, RepairFailure } from "../worker/repair-controller";
import { evidenceDecisionDigest, EvidenceSession, sourcePassages } from "../worker/evidence";
import { abstractResearch } from "../src/lib/research-bundle";
import { initialState } from "../src/lib/catalog";
import { markKitComponent, publishKitComponent } from "../src/lib/kit-publication";
import type { Job } from "../src/lib/types";

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "kit-recovery-"));
  const paper = initialState().papers[0]; paper.recall = null; paper.scene = null; paper.visual = undefined; paper.study = undefined;
  const source = { ...paper.sources[0], excerpt: "The method selects a route for each token." }; paper.sources = [source];
  const sourceId = `${source.id}:${fingerprint([source.url, source.excerpt]).slice(0, 16)}`;
  const explanation = { version: 2, idea: "Tokens choose routes.", problem: "Dense routing is costly.", mechanism: "Select a route for each token.", evidence: "Sparse routing is described.", limitation: "Only abstract evidence is available.", significance: "This controls computation.", equations: [], sourceIds: [sourceId] };
  const job: Job = { id: "recovery-run", type: "generate", paperId: paper.id, status: "running", attempts: 1, createdAt: new Date().toISOString(), leaseToken: "test", leaseUntil: new Date(Date.now() + 3600000).toISOString() };
  const names: string[] = [];
  const runtime: KitRuntime = { dir, checkpointRoot: path.join(dir, "checkpoints"), runId: job.id, implementationDigest: "a".repeat(64), research: abstractResearch([source]),
    model: async (_, schema, name) => {
      names.push(name);
      if (name === "kit-plan") return schema.parse({ requirements: ["Explain how each token chooses a route."], equations: [], example: "No reported numerical results.", diagram: { proof: "Trace the token routing choice.", objects: 3, representation: "flow" }, figures: [{ id: "trace", question: "How does a token reach its destination?", kind: "bars" }], sourceIds: [sourceId] });
      if (name === "plan-evidence" || name.endsWith("select-sources")) return schema.parse({ sourceIds: [sourceId] });
      if (name.startsWith("plan-feasibility")) return schema.parse({ feasible: true, blockers: [] });
      if (name === "explanation-draft") return schema.parse({ content: explanation });
      if (name.includes("source-review")) return schema.parse({ approved: true, findings: [], equationAudits: [] });
      throw new RepairFailure("execution", "Deterministic model interruption.");
    }, render: async () => [], progress: async () => {}, status: async (id, state) => { markKitComponent(paper, id, state); }, publish: async publication => publishKitComponent(paper, job, publication, "test", new Date().toISOString()) };
  return { dir, paper, job, runtime, names, explanation, sourceId, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("handled execution failure saves terminal approved partial paper and not-run components", async () => {
  const f = await fixture();
  try {
    await assert.rejects(generateKit(f.paper, f.runtime), /interruption/);
    const result = JSON.parse(await readFile(path.join(f.dir, "result.json"), "utf8"));
    assert.deepEqual(result.outcomes.map((o: any) => [o.id, o.status]), [["explanation", "passed"], ["diagram", "failed"], ["figure:trace", "not-run"], ["quiz", "not-run"]]);
    assert.deepEqual(result.paper.recall, f.explanation); assert.equal(result.paper.scene, null); assert.equal(result.paper.study, undefined);
    assert.equal(result.failure.owner, "execution");
    const report = JSON.parse(await readFile(path.join(f.dir, "kit-quality-report.json"), "utf8")); assert.equal(report.status, "interrupted"); assert.deepEqual(report.outcomes, result.outcomes);
  } finally { await f.cleanup(); }
});

test("thrown review checkpoints the merged ledger without changing its private candidate", async () => {
  let checkpoint: any;
  const initial = { value: 0 }, obligation = { id: "new", owner: "content" as const, category: "math", targets: ["/value"], evidence: "The value must be positive.", acceptance: "Use a positive value.", sourceIds: [], status: "open" as const, occurrences: 1 };
  await assert.rejects(repairCandidate(initial, { schema: z.object({ value: z.number() }), maxRepairs: 1, record: async () => {}, validate: () => {}, checkpoint: async state => { checkpoint = structuredClone(state); },
    review: async () => { throw new RepairFailure("content", "Source dispute", [obligation]); }, edit: async () => { throw Error("No edit allowed"); }, replan: async () => { throw Error("No fallback allowed"); } }), /Source dispute/);
  assert.deepEqual(checkpoint.candidate, initial); assert.deepEqual(checkpoint.ledger, [obligation]); assert.equal(checkpoint.round, 0);
});

for (const corruption of ["missing", "syntax", "shape", "binding"]) test(`same-job ${corruption} run checkpoint fails closed before a model call`, async () => {
  const f = await fixture();
  try {
    const store = new KitCheckpoints(f.runtime.checkpointRoot, f.paper.id);
    if (corruption !== "missing") {
      await store.write({ version: 1, binding: fingerprint([f.runtime.runId, f.runtime.implementationDigest]), componentId: "run", candidate: { used: { opening: -1, supplement: 0 }, fallbacks: { opening: false, supplement: false }, enrichments: { opening: 0, supplement: 0 }, completed: [] } });
      const file = path.join(f.runtime.checkpointRoot, fingerprint(f.paper.id), fingerprint("run") + ".json");
      if (corruption === "syntax") await writeFile(file, "{");
      if (corruption === "binding") { const value = JSON.parse(await readFile(file, "utf8")); value.binding = "b".repeat(64); await writeFile(file, JSON.stringify(value)); }
    }
    await assert.rejects(generateKit(f.paper, { ...f.runtime, runMode: "resume" } as KitRuntime), /[Cc]heckpoint|[Rr]ecovery/);
    assert.deepEqual(f.names, []);
  } finally { await f.cleanup(); }
});

test("an explicit new retry may create its own bounded run despite an unavailable prior checkpoint", async () => {
  const f = await fixture();
  try { await assert.rejects(generateKit(f.paper, { ...f.runtime, runMode: "new" } as KitRuntime), /interruption/); assert.ok(f.names.includes("kit-plan")); }
  finally { await f.cleanup(); }
});

test("recreated component preserves ordered focus instead of rebuilding it from the source union", async () => {
  const f = await fixture();
  try {
    const other = { ...f.paper.sources[0], id: "second", excerpt: "A second exact excerpt describes the same routing mechanism." };
    const otherId = `${other.id}:${fingerprint([other.url, other.excerpt]).slice(0, 16)}`;
    f.runtime.research = { ...abstractResearch(f.paper.sources), catalogue: [...f.paper.sources, other], sources: f.paper.sources };
    const base = f.runtime.model;
    f.runtime.model = async (prompt, schema, name, images) => name.includes("source-review") ? Promise.reject(new RepairFailure("execution", "Review interruption.")) : base(prompt, schema, name, images);
    await assert.rejects(generateKit(f.paper, { ...f.runtime, target: "explanation" }), /interruption/);
    const store = new KitCheckpoints(f.runtime.checkpointRoot, f.paper.id);
    const file = path.join(f.runtime.checkpointRoot, fingerprint(f.paper.id), fingerprint("explanation") + ".json");
    const saved = JSON.parse(await readFile(file, "utf8")); const second = { ...other, id: otherId };
    saved.sources.push(second); saved.focusedSources = [second, saved.sources[0]]; await store.write(saved);
    const seen: string[][] = [];
    f.runtime.model = async (prompt, schema, name, images) => {
      if (name.includes("source-review")) { const data = JSON.parse(prompt.split("PRIMARY EVIDENCE:\n")[1]); seen.push(data.sources.map((s: any) => s.id)); }
      return base(prompt, schema, name, images);
    };
    await generateKit(f.paper, { ...f.runtime, target: "explanation", runMode: "resume" } as KitRuntime);
    const updated = JSON.parse(await readFile(file, "utf8")); assert.deepEqual(updated.focusedSources.map((s: any) => s.id), [otherId, f.sourceId]); assert.deepEqual(seen[0], [f.sourceId, otherId]);
  } finally { await f.cleanup(); }
});

for (const corruption of ["candidate", "ledger", "round", "focus", "cache"]) test(`same-job invalid component ${corruption} fails closed before any model call`, async () => {
  const f = await fixture();
  try {
    const base = f.runtime.model;
    f.runtime.model = async (prompt, schema, name, images) => name.includes("source-review") ? Promise.reject(new RepairFailure("execution", "Review interruption.")) : base(prompt, schema, name, images);
    await assert.rejects(generateKit(f.paper, { ...f.runtime, target: "explanation" }), /interruption/);
    const file = path.join(f.runtime.checkpointRoot, fingerprint(f.paper.id), fingerprint("explanation") + ".json");
    const saved = JSON.parse(await readFile(file, "utf8"));
    if (corruption === "candidate") saved.candidate = saved.repair.candidate = { content: { invalid: true } };
    if (corruption === "ledger") saved.repair.ledger = [{ status: "invented" }];
    if (corruption === "round") saved.repair.round = 1;
    if (corruption === "focus") saved.focusedSources = [{ ...saved.sources[0], excerpt: "Changed private evidence." }];
    if (corruption === "cache") saved.evidenceDecisions = [["a".repeat(64), [{ id: "bad", disposition: "supported-defect", rationale: "Missing receipt", requirement: "Missing receipt", support: [] }]]];
    await writeFile(file, JSON.stringify(saved)); f.names.length = 0;
    await assert.rejects(generateKit(f.paper, { ...f.runtime, target: "explanation", runMode: "resume" } as KitRuntime), /Recovery component checkpoint/);
    assert.deepEqual(f.names, []);
  } finally { await f.cleanup(); }
});

test("checkpoint writer rejects a repair shape its reader cannot restore", async () => {
  const f = await fixture();
  try { await assert.rejects(new KitCheckpoints(f.runtime.checkpointRoot, f.paper.id).write({ version: 1, binding: "same", componentId: "diagram", candidate: {}, repair: { candidate: {}, ledger: [], round: 99, replanned: false, seen: [] } })); }
  finally { await f.cleanup(); }
});

test("handled failure preserves every retained evidence decision rather than a tail of sixty-four", async () => {
  const f = await fixture();
  try {
    const base = f.runtime.model;
    f.runtime.model = async (prompt, schema, name, images) => name.includes("source-review") ? Promise.reject(new RepairFailure("execution", "Review interruption.")) : base(prompt, schema, name, images);
    await assert.rejects(generateKit(f.paper, { ...f.runtime, target: "explanation" }), /interruption/);
    const file = path.join(f.runtime.checkpointRoot, fingerprint(f.paper.id), fingerprint("explanation") + ".json");
    const saved = JSON.parse(await readFile(file, "utf8"));
    saved.evidenceDecisions = Array.from({ length: 80 }, (_, i) => {
      const decision = { id: `retained-${i}`, disposition: "supported-defect", rationale: "An exact stored evidence decision.", requirement: "Keep the exact routing claim.", support: [{ sourceId: saved.sources[0].id, passage: saved.sources[0].excerpt }] };
      return [fingerprint(i), [{ ...decision, receipt: { version: 1, candidate: fingerprint(saved.candidate), binding: fingerprint("prior review"), scope: fingerprint(`scope-${i}`), decision: evidenceDecisionDigest(decision as any), sources: fingerprint(saved.sources), sourceIds: saved.sources.map((s: any) => s.id) } }]];
    });
    await writeFile(file, JSON.stringify(saved));
    await assert.rejects(generateKit(f.paper, { ...f.runtime, target: "explanation", runMode: "resume" } as KitRuntime), /interruption/);
    const updated = JSON.parse(await readFile(file, "utf8")); assert.deepEqual(updated.evidenceDecisions, saved.evidenceDecisions);
  } finally { await f.cleanup(); }
});

test("an adopted private patch and reserved round survive interrupted artifact recording", async () => {
  let checkpoint: any;
  const schema = z.object({ value: z.number() }), initial = { value: 0 };
  await assert.rejects(repairCandidate(initial, { schema, maxRepairs: 1, validate: () => {}, checkpoint: async state => { checkpoint = structuredClone(state); },
    record: async name => { if (name.startsWith("patch-")) throw new RepairFailure("execution", "Artifact interruption"); },
    review: async () => ({ defects: [{ id: "positive", owner: "content", category: "math", targets: ["/value"], evidence: "Value is zero.", acceptance: "Set the value to one.", sourceIds: [] }], verified: [], complete: false }),
    edit: async (candidate, targets) => ({ base: fingerprint(candidate), preimages: { t0: targets[0].fingerprint }, changes: { t0: 1 } }), replan: async () => { throw Error("No fallback needed"); } }), /Artifact interruption/);
  assert.deepEqual(checkpoint.candidate, { value: 1 }); assert.equal(checkpoint.round, 1);
});

test("recovery preserves resolved and replacement history after old native leaf targets disappear", async () => {
  const f = await fixture();
  try {
    const source = { ...f.paper.sources[0], id: f.sourceId }, candidate = { value: 1 };
    const entry = { id: "old-vector", category: "visual-vector", owner: "representation" as const, targets: ["/old/values/0"], artifact: "/content", sourceIds: [source.id], evidence: "The old vector was replaced by a scalar.", acceptance: "The scalar retains the declared quantity.", status: "resolved" as const, occurrences: 1,
      replacement: { artifact: "/content", before: fingerprint({ old: [0] }), after: fingerprint(candidate), round: 1 } };
    const value = { version: 1 as const, binding: "bound", componentId: "diagram", candidate, sources: [source], focusedSources: [source], evidenceDecisions: [], repair: { candidate, ledger: [entry], round: 1, replanned: true, seen: [] } };
    const checked = validateKitComponentCheckpoint(value, z.object({ value: z.number() }));
    const store = new KitCheckpoints(f.runtime.checkpointRoot, f.paper.id); await store.write(checked);
    assert.deepEqual((await store.read("diagram", "bound"))?.repair?.ledger, checked.repair?.ledger);
    assert.throws(() => validateKitComponentCheckpoint({ ...value, repair: { ...value.repair, ledger: [{ ...entry, targets: ["/constructor/value"] }] } }, z.object({ value: z.number() })), /unsafe/);
  } finally { await f.cleanup(); }
});

test("private complete overlong text survives checkpoint recreation while publication limits remain native", async () => {
  const f = await fixture();
  try {
    const source = { ...f.paper.sources[0], id: f.sourceId }, candidate = { text: "A complete private sentence. ".repeat(20) }, native = z.object({ text: z.string().max(40) });
    const value = { version: 1 as const, binding: "bound", componentId: "explanation", candidate, sources: [source], focusedSources: [source], evidenceDecisions: [], repair: { candidate, ledger: [], round: 1, replanned: false, seen: [] } };
    const checked = validateKitComponentCheckpoint(value, native); const store = new KitCheckpoints(f.runtime.checkpointRoot, f.paper.id); await store.write(checked);
    assert.deepEqual((await store.read("explanation", "bound"))?.candidate, candidate); assert.throws(() => native.parse(candidate));
  } finally { await f.cleanup(); }
});

for (const phase of ["review", "adjudication", "refresh"]) test(`new ${phase} obligations survive interrupted diagnostic recording`, async () => {
  let checkpoint: any;
  const candidate = { value: 0 }, schema = z.object({ value: z.number() });
  const defect = { id: "positive", owner: "content" as const, category: "math", targets: ["/value"], evidence: "Value is zero.", acceptance: "Set the value to one.", sourceIds: ["source"] };
  await assert.rejects(repairCandidate(candidate, { schema, maxRepairs: 1, validate: () => {}, checkpoint: async state => { checkpoint = structuredClone(state); },
    record: async name => { if (name.startsWith(phase === "refresh" ? "evidence-refresh-" : `${phase}-`)) throw new RepairFailure("execution", "Diagnostic interruption"); },
    review: async (_, context) => ({ defects: phase === "adjudication" ? [] : [defect], verified: [], complete: false, refresh: phase !== "review",
      ...(phase === "adjudication" ? { adjudications: [{ defect, candidate: context.fingerprint, binding: context.binding!, rationale: "An exact source adjudication.", support: [{ sourceId: "source", passage: "Exact received passage." }] }] } : {}) }),
    edit: async () => { throw Error("No edit reached"); }, replan: async () => { throw Error("No fallback reached"); } }), /Diagnostic interruption/);
  assert.equal(checkpoint.ledger.length, 1); assert.equal(checkpoint.ledger[0].id, defect.id); assert.deepEqual(checkpoint.candidate, candidate);
  if (phase === "adjudication") assert.equal(checkpoint.ledger[0].adjudication.support[0].passage, "Exact received passage.");
});

test("authoritative component checkpoint survives evidence-history artifact write failure", async () => {
  const f = await fixture();
  try {
    let interrupted = false;
    f.runtime.progress = async stage => {
      if (stage === "reviewing" && !interrupted) { interrupted = true; const file = path.join(f.dir, "explanation", "evidence-history.json"); await rm(file); await mkdir(file); }
    };
    await assert.rejects(generateKit(f.paper, { ...f.runtime, target: "explanation" }), /directory|EISDIR/);
    const file = path.join(f.runtime.checkpointRoot, fingerprint(f.paper.id), fingerprint("explanation") + ".json");
    const saved = JSON.parse(await readFile(file, "utf8")); assert.deepEqual(saved.candidate.content, f.explanation); assert.deepEqual(saved.focusedSources, saved.sources);
    const result = JSON.parse(await readFile(path.join(f.dir, "result.json"), "utf8")); assert.equal(result.outcomes[0].status, "failed");
  } finally { await f.cleanup(); }
});

test("interrupted evidence selection reserves its stage allowance before calling the model", async () => {
  const source = { id: "first", label: "First", url: "https://arxiv.org/abs/2305.14314", excerpt: "An exact source passage." }, other = { ...source, id: "second" };
  const session = new EvidenceSession({ ...abstractResearch([source]), catalogue: [source, other] }, "Paper");
  let reserved = 0;
  const context = { round: 0, fingerprint: fingerprint({}), binding: fingerprint("binding"), catalog: [], obligations: [] };
  const interrupted = async () => { assert.equal(reserved, 1); throw new RepairFailure("execution", "Selection interruption"); };
  await assert.rejects(session.enrich(interrupted, [], {}, context, {}, async passes => { reserved = passes; }), /Selection interruption/);
  assert.equal(session.passes, 1); assert.deepEqual(session.bundle.sources, [source]);
});

async function committedGap(f: Awaited<ReturnType<typeof fixture>>) {
  let committed = false;
  const publish = f.runtime.publish;
  f.runtime.publish = async publication => { const receipt = await publish(publication); committed = true; return receipt; };
  f.runtime.assertLease = async () => { if (committed) throw new RepairFailure("execution", "Checkpoint interrupted after durable publication."); };
  await assert.rejects(generateKit(f.paper, f.runtime), /Checkpoint interrupted/);
  f.runtime.assertLease = async () => {};
  f.job.leaseToken = "reclaimed"; f.job.attempts = 2;
  f.runtime.publish = async publication => publishKitComponent(f.paper, f.job, publication, "reclaimed", new Date().toISOString());
  f.names.length = 0;
}

test("terminal result retains one passed publication fact when its following checkpoint fails", async () => {
  const f = await fixture();
  try {
    await committedGap(f);
    const result = JSON.parse(await readFile(path.join(f.dir, "result.json"), "utf8"));
    assert.deepEqual(result.outcomes.filter((o: any) => o.id === "explanation").map((o: any) => o.status), ["passed"]);
    assert.deepEqual(result.paper.recall, f.explanation); assert.equal(result.failure.owner, "execution");
  } finally { await f.cleanup(); }
});

test("reclaimed current-job receipt bridges the committed publication to missing completion checkpoint", async () => {
  const f = await fixture();
  try {
    await committedGap(f);
    const statuses: string[] = [], status = f.runtime.status;
    f.runtime.status = async (id, state) => { statuses.push(id); await status(id, state); };
    f.runtime.progress = async () => {
      const file = path.join(f.runtime.checkpointRoot, fingerprint(f.paper.id), fingerprint("run") + ".json");
      assert.ok(JSON.parse(await readFile(file, "utf8")).candidate.completed.includes("explanation"));
    };
    await assert.rejects(generateKit(f.paper, { ...f.runtime, runMode: "resume", committedComponents: f.job.componentReceipts!.map(({ componentId, revision }) => ({ componentId, revision })) } as KitRuntime), /interruption/);
    assert.ok(!f.names.some(name => name.startsWith("explanation-"))); assert.ok(!statuses.includes("explanation"));
    const result = JSON.parse(await readFile(path.join(f.dir, "result.json"), "utf8")); assert.equal(result.outcomes[0].status, "passed");
    assert.equal(f.job.componentReceipts!.length, 1);
  } finally { await f.cleanup(); }
});

test("a new explicit job cannot skip its requested replacement using old-job receipts", async () => {
  const f = await fixture();
  try {
    await committedGap(f);
    const job: Job = { ...f.job, id: "explicit-new-job", attempts: 1, leaseToken: "new-retry", componentReceipts: undefined };
    const result = await generateKit(f.paper, { ...f.runtime, runId: job.id, runMode: "new", target: "explanation", publish: async publication => publishKitComponent(f.paper, job, publication, "new-retry", new Date().toISOString()), committedComponents: f.job.componentReceipts!.map(({ componentId, revision }) => ({ componentId, revision })) } as KitRuntime);
    assert.ok(f.names.some(name => name.startsWith("explanation-source-review"))); assert.equal(result.outcomes[0].status, "passed");
  } finally { await f.cleanup(); }
});

for (const authority of ["receipt", "checkpoint"]) test(`stale ${authority} completion revision is pruned and reviewed instead of skipped`, async () => {
  const f = await fixture();
  try {
    if (authority === "receipt") await committedGap(f);
    else { await assert.rejects(generateKit(f.paper, f.runtime), /interruption/); f.names.length = 0; }
    f.paper.kit!.components.find(c => c.id === "explanation")!.revision = "b".repeat(64);
    f.runtime.publish = async () => { throw new RepairFailure("execution", "Re-review reached publication."); };
    await assert.rejects(generateKit(f.paper, { ...f.runtime, target: "explanation", runMode: "resume", committedComponents: f.job.componentReceipts!.map(({ componentId, revision }) => ({ componentId, revision })) }), /Re-review reached publication|Recovery component checkpoint/);
    const file = path.join(f.runtime.checkpointRoot, fingerprint(f.paper.id), fingerprint("run") + ".json");
    const run = JSON.parse(await readFile(file, "utf8")).candidate;
    assert.deepEqual(run.completed, []); assert.deepEqual(run.completedRevisions, {});
    if (authority === "receipt") assert.ok(f.names.some(name => name.startsWith("explanation-source-review")));
    else assert.deepEqual(f.names, []); // The already-started diagram checkpoint has stale dependencies.
  } finally { await f.cleanup(); }
});

test("matching receipt revisions cannot recover a component with changed published dependencies", async () => {
  const f = await fixture();
  try {
    await committedGap(f);
    const explanationRevision = f.paper.kit!.components.find(c => c.id === "explanation")!.revision!;
    f.paper.kit!.components.push({ id: "diagram", state: "ready", revision: "c".repeat(64), dependencies: { explanation: "old-explanation" }, sourceIds: [f.sourceId] });
    const file = path.join(f.runtime.checkpointRoot, fingerprint(f.paper.id), fingerprint("run") + ".json");
    const saved = JSON.parse(await readFile(file, "utf8"));
    saved.candidate.started.push("diagram"); saved.candidate.completed.push("diagram"); saved.candidate.completedRevisions.diagram = "c".repeat(64);
    await new KitCheckpoints(f.runtime.checkpointRoot, f.paper.id).write(saved);
    const statuses: string[] = []; f.runtime.status = async id => { statuses.push(id); };
    await assert.rejects(generateKit(f.paper, { ...f.runtime, runMode: "resume", committedComponents: [{ componentId: "explanation", revision: explanationRevision }, { componentId: "diagram", revision: "c".repeat(64) }] }), /Recovery component checkpoint/);
    const run = JSON.parse(await readFile(file, "utf8")).candidate;
    assert.deepEqual(run.completed, ["explanation"]); assert.deepEqual(run.completedRevisions, { explanation: explanationRevision });
    assert.deepEqual(f.names, []); assert.deepEqual(statuses, []);
  } finally { await f.cleanup(); }
});

test("invalid reclaimed receipt projection fails closed before model and status calls", async () => {
  const f = await fixture();
  try {
    await committedGap(f);
    const statuses: string[] = []; f.runtime.status = async id => { statuses.push(id); };
    await assert.rejects(generateKit(f.paper, { ...f.runtime, runMode: "resume", committedComponents: [{ componentId: "explanation", revision: "" }] }), /receipt projection is invalid/);
    assert.deepEqual(f.names, []); assert.deepEqual(statuses, []);
  } finally { await f.cleanup(); }
});

for (const artifact of ["defect-identities", "reviews"]) test(`inner ${artifact} filesystem failure retains new findings and prior ledger without approving verification`, async () => {
  const f = await fixture();
  try {
    const base = f.runtime.model;
    const prior = { owner: "content" as const, category: "private-diagnostic", targets: ["/content/mechanism"], sourceIds: [f.sourceId], evidence: "The field needs inspection.", acceptance: "Inspect the retained field.", occurrences: 1 };
    f.runtime.model = async (prompt, schema, name, images) => {
      if (name.includes("source-review")) throw new RepairFailure("execution", "Seed retained history.", [{ ...prior, id: "resolved-history", status: "resolved" }, { ...prior, id: "pending-history", status: "open" }]);
      return base(prompt, schema, name, images);
    };
    await assert.rejects(generateKit(f.paper, { ...f.runtime, target: "explanation" }), /Seed retained history/);
    const file = path.join(f.runtime.checkpointRoot, fingerprint(f.paper.id), fingerprint("explanation") + ".json");
    const before = JSON.parse(await readFile(file, "utf8"));
    const finding = { invariant: "routing-source", objectId: "routing", owner: "content", targets: ["/content/mechanism"], evidence: "The routing claim needs its supported per-token condition.", acceptance: "State the supported per-token condition.", sourceIds: [f.sourceId] };
    const id = fingerprint([finding.objectId, finding.invariant]).slice(0, 32);
    const passageId = sourcePassages(before.sources)[0].id;
    f.runtime.progress = async stage => { if (stage === "reviewing") await mkdir(path.join(f.dir, "explanation", `${artifact}-0.json`)); };
    f.runtime.model = async (prompt, schema, name, images) => {
      f.names.push(name);
      const wire = z.toJSONSchema(schema) as any;
      if (name.includes("source-review")) return schema.parse({ approved: false, findings: [finding], equationAudits: [] });
      if (name.includes("defect-identities")) return schema.parse({ candidate: wire.properties.candidate.const, mappings: { f0: { sameAs: null, reason: "This is a distinct routing invariant." } } });
      if (name.includes("verify-defects")) return schema.parse({ candidate: wire.properties.candidate.const, binding: wire.properties.binding.const, checks: [{ id: "pending-history", resolved: true, resolution: "same-representation", evidence: "Model verification has not yet been validated by the controller." }] });
      if (name.includes("-evidence-")) return schema.parse({ candidate: wire.properties.candidate.const, binding: wire.properties.binding.const, decisions: [{ id, disposition: "supported-defect", rationale: "The exact excerpt supports the per-token requirement.", passageIds: [passageId], requirement: "Explain how each token chooses a route." }] });
      return base(prompt, schema, name, images);
    };
    await assert.rejects(generateKit(f.paper, { ...f.runtime, target: "explanation", runMode: "resume" }), /diagnostic|Review did not complete/);
    if (artifact === "reviews") assert.ok(f.names.some(name => name.includes("-evidence-")), "The combined diagnostic control must reach completed source adjudication");
    const saved = JSON.parse(await readFile(file, "utf8"));
    assert.ok(saved.repair.ledger.some((entry: any) => entry.id === id), "The newly computed routing finding must survive inner artifact failure");
    assert.equal(saved.repair.ledger.find((entry: any) => entry.id === "resolved-history").status, "resolved");
    assert.equal(saved.repair.ledger.find((entry: any) => entry.id === "pending-history").status, "open");
    assert.equal(saved.repair.ledger.find((entry: any) => entry.id === "pending-history").verification, undefined);
    assert.deepEqual(saved.candidate, before.candidate); assert.deepEqual(saved.focusedSources, before.focusedSources); assert.equal(saved.repair.round, 0);
    const current = saved.repair.ledger.find((entry: any) => entry.id === id);
    if (artifact === "reviews") { assert.equal(current.sourceProof.support[0].passage, before.sources[0].excerpt); assert.equal(saved.evidenceDecisions.length, 1); }
    else { assert.equal(current.sourceProof, undefined); assert.equal(saved.evidenceDecisions.length, 0); }
    const runFile = path.join(f.runtime.checkpointRoot, fingerprint(f.paper.id), fingerprint("run") + ".json");
    const run = JSON.parse(await readFile(runFile, "utf8")).candidate;
    assert.deepEqual(run.used, { opening: 0, supplement: 0 }); assert.deepEqual(run.fallbacks, { opening: false, supplement: false }); assert.deepEqual(run.enrichments, { opening: 0, supplement: 0 });
    const result = JSON.parse(await readFile(path.join(f.dir, "result.json"), "utf8"));
    assert.equal(result.failure.owner, "execution"); assert.ok(result.failure.ledger.some((entry: any) => entry.id === id)); assert.equal(result.outcomes[0].status, "failed"); assert.equal(f.job.componentReceipts, undefined);
  } finally { await f.cleanup(); }
});
