import { candidateSchema, textBoundFindings } from "./text-bounds";
import { validationProgress, changedFieldPaths, type ValidationFinding } from "./validation-findings";
import { createHash } from "node:crypto";
import { z } from "zod";

export const defectOwnerSchema = z.enum(["content", "representation", "renderer", "schema", "execution"]);
export type DefectOwner = z.infer<typeof defectOwnerSchema>;
export const defectSchema = z.object({
  id: z.string().min(1).max(80), category: z.string().min(1).max(80), owner: defectOwnerSchema,
  targets: z.array(z.string().min(1).max(300)).max(24), evidence: z.string().min(1).max(4000),
  invariant: z.string().max(160).optional(), objectId: z.string().max(160).optional(),
  acceptance: z.string().min(1).max(4000), sourceIds: z.array(z.string()).max(14),
  artifact: z.string().max(300).nullish(),
  sourceProof: z.object({ sources: z.string().length(64), support: z.array(z.object({ sourceId: z.string(), passage: z.string().min(1).max(1800) })).min(1).max(8), requirement: z.string().min(1).max(1000) }).optional(),
});
function controlledDefect(raw: RepairDefect): RepairDefect {
  const defect = defectSchema.parse(raw);
  if (defect.invariant && defect.objectId) defect.id = fingerprint([defect.objectId, defect.invariant.toLowerCase().replaceAll("_", "-")]).slice(0, 32);
  return defect;
}
export type RepairDefect = z.infer<typeof defectSchema>;
export type Target = { path: string; schema: z.ZodType; value: unknown; fingerprint: string; constraints: unknown };
export type Adjudication = { defect: RepairDefect; candidate: string; binding: string; rationale: string; support: { sourceId: string; passage: string }[] };
export type LedgerEntry = RepairDefect & { adjudication?: Adjudication; status: "open" | "resolved" | "recurring" | "disputed"; occurrences: number; verification?: string; replacement?: { artifact: string; before: string; after: string; round: number; beforeKind?: string; afterKind?: string } };
export type Verification = { id: string; resolved: boolean; evidence: string; resolution?: "same-representation" | "replacement" | "adjudication" };
export function fingerprint(value: unknown): string {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object"
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])) : v;
  return createHash("sha256").update(JSON.stringify(canonical(value)) ?? "undefined").digest("hex");
}
export class RepairFailure extends Error {
  constructor(public owner: DefectOwner, message: string, public ledger: LedgerEntry[] = [], public rounds?: number) { super(message); this.name = "RepairFailure"; }
}
const escapePointer = (value: string) => value.replaceAll("~", "~0").replaceAll("/", "~1");
function parts(path: string) {
  if (!path.startsWith("/") || path === "/") throw new RepairFailure("schema", "Invalid repair target.");
  const keys = path.slice(1).split("/").map(p => p.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (keys.some(k => ["__proto__", "prototype", "constructor"].includes(k))) throw new RepairFailure("schema", "Unsafe repair target.");
  return keys;
}
export function valueAt(candidate: unknown, path: string): unknown {
  let value: any = candidate;
  for (const key of parts(path)) value = value?.[key];
  return value;
}
function replaceAt(candidate: any, path: string, value: unknown) {
  const keys = parts(path); let parent = candidate;
  for (const key of keys.slice(0, -1)) {
    if (parent == null || !Object.hasOwn(parent, key)) throw new RepairFailure("schema", "Repair target no longer exists.");
    parent = parent[key];
  }
  parent[keys.at(-1)!] = value;
}
/** Catalogued native schemas are the only patch interface. Objects are edited through their fields. */
export function targetCatalog(candidate: unknown, schema: z.ZodType): Target[] {
  const targets: Target[] = [];
  function visit(value: any, original: z.ZodType, path: string) {
    let inner: any = original;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodNullable || inner instanceof z.ZodDefault) inner = inner.unwrap();
    if (inner instanceof z.ZodUnion || inner instanceof z.ZodDiscriminatedUnion) {
      const option = inner.options.find((s: any) => candidateSchema(s).safeParse(value).success);
      if (!option) return; inner = option;
    }
    const isObject = inner instanceof z.ZodObject, isArray = inner instanceof z.ZodArray;
    // Whole artifacts and panel lists are reserved for the explicit replan path.
    const container = ["", "/recall", "/scene", "/scene/illustration", "/scene/illustration/panels", "/figures", "/quiz"].includes(path)
      || /^\/figures\/\d+\/illustration(?:\/panels)?$/.test(path);
    if (path && !container && (!isObject || value == null) && !(isArray && path.endsWith("/panels"))) {
      targets.push({ path, schema: original, value, fingerprint: fingerprint(value), constraints: z.toJSONSchema(original) });
    }
    if (value == null) return;
    if (isObject) for (const [key, field] of Object.entries(inner.shape)) visit(value[key], field as z.ZodType, `${path}/${escapePointer(key)}`);
    if (isArray) value.forEach((item: unknown, i: number) => visit(item, inner.element, `${path}/${i}`));
  }
  visit(candidate, schema, ""); return targets;
}
export function patchSchema(targets: Target[], base: string) {
  if (!targets.length) throw new RepairFailure("schema", "A repair needs explicit targets.");
  const changes: Record<string, z.ZodType> = {}, preimages: Record<string, z.ZodType> = {};
  targets.forEach((target, i) => { changes[`t${i}`] = target.value && typeof target.value === "object" ? candidateSchema(target.schema) : target.schema; preimages[`t${i}`] = z.literal(target.fingerprint); });
  return z.object({ base: z.literal(base), preimages: z.object(preimages).strict(), changes: z.object(changes).strict() }).strict();
}
export function applyPatch<T>(candidate: T, schema: z.ZodType<T>, targets: Target[], response: unknown): T {
  if (targets.some(t => targets.some(parent => parent !== t && t.path.startsWith(parent.path + "/"))) || new Set(targets.map(t => t.path)).size !== targets.length)
    throw new RepairFailure("schema", "Overlapping repair targets are invalid.");
  const patch = patchSchema(targets, fingerprint(candidate)).parse(response);
  for (const target of targets) if (fingerprint(valueAt(candidate, target.path)) !== target.fingerprint)
    throw new RepairFailure("schema", "Stale repair preimage.");
  const result = structuredClone(candidate);
  for (const [i, target] of targets.entries()) replaceAt(result, target.path, patch.changes[`t${i}`]);
  const parsed = candidateSchema(schema).parse(result);
  for(const finding of textBoundFindings(parsed,schema)) {
    const field=finding.paths[0];
    if(fingerprint(valueAt(candidate,field))!==fingerprint(valueAt(parsed,field)))throw new RepairFailure("schema",`${field}: ${finding.message}`);
  }
  if (fingerprint(candidate) === fingerprint(parsed)) throw new RepairFailure("content", "Repair made no change.");
  return parsed;
}
export type Review = { defects: RepairDefect[]; verified: Verification[]; complete: boolean; evidence?: unknown; disputedIds?: string[]; refresh?: boolean; adjudications?: Adjudication[] };
export type RepairContext = { round: number; fingerprint: string; binding?: string; catalog: Target[]; obligations: LedgerEntry[]; history?: LedgerEntry[]; adjudications?: Adjudication[] };
export type RepairAdapters<T> = {
  schema: z.ZodType<T> | (() => z.ZodType<T>); maxRepairs: number;
  binding?: unknown;
  replanAvailable?: boolean;
  allowRepresentationFallback?: boolean;
  review: (candidate: T, context: RepairContext) => Promise<Review>;
  edit: (candidate: T, targets: Target[], defects: RepairDefect[], context: RepairContext) => Promise<unknown>;
  replan: (candidate: T, defects: RepairDefect[], context: RepairContext) => Promise<{ patch: unknown; targets: Target[]; validate?: (candidate: T) => void; adopt?: () => void }>;
  validate: (candidate: T) => void;
  inspect?: (candidate: T) => ValidationFinding[];
  checkpoint?: (state: RepairCheckpoint<T>) => Promise<void>;
  resume?: RepairCheckpoint<T>;
  auditPatch?: (previous: T, proposed: T, targets: Target[], context: RepairContext) => Promise<void>;
  record: (event: string, data: unknown) => Promise<void>;
};
export type RepairCheckpoint<T> = { candidate: T; ledger: LedgerEntry[]; round: number; replanned: boolean; seen: string[] };

/** Every attempted patch/replan consumes a round. No omitted or stale verdict can approve an open defect. */
export async function repairCandidate<T>(initial: T, adapters: RepairAdapters<T>): Promise<{ candidate: T; ledger: LedgerEntry[]; rounds: number }> {
  const schema = () => typeof adapters.schema === "function" ? adapters.schema() : adapters.schema;
  let candidate = candidateSchema(schema()).parse(adapters.resume?.candidate ?? initial), replanned = adapters.resume?.replanned ?? adapters.replanAvailable === false;
  const ledger = new Map<string, LedgerEntry>((adapters.resume?.ledger ?? []).map(d => [d.id, d])), seen = new Set<string>(adapters.resume?.seen ?? []);
  let rejectedPatch: RepairDefect | undefined;
  let round = adapters.resume?.round ?? 0, refreshes = 0;
  while (round <= adapters.maxRepairs) {
    const catalog = targetCatalog(candidate, schema()), hash = fingerprint(candidate);
    const binding = fingerprint({ candidate: hash, inputs: adapters.binding });
    const context: RepairContext = { round, fingerprint: hash, binding, catalog, history: [...ledger.values()], obligations: [...ledger.values()].filter(d => d.status !== "resolved"), adjudications: [...ledger.values()].flatMap(d => d.adjudication && d.adjudication.candidate === hash && d.adjudication.binding === binding ? [d.adjudication] : []) };
    await adapters.checkpoint?.({ candidate, ledger: [...ledger.values()], round, replanned, seen: [...seen] });
    await adapters.record(`candidate-${round}`, { candidate, fingerprint: hash, binding, inputs: adapters.binding });
    let review: Review;
    try { review = await adapters.review(candidate, context); }
    catch (error) {
      if (error instanceof RepairFailure) throw new RepairFailure(error.owner, error.message, [...new Map([...ledger.values(), ...error.ledger].map(d => [d.id, d])).values()], round);
      throw new RepairFailure("execution", "Review did not complete.", [...ledger.values()], round);
    }
    const bounds = textBoundFindings(candidate, schema());
    const nativeKeys = new Set(bounds.map(f => fingerprint([f.objectId, f.invariant]).slice(0,32)));
    const duplicateIds = review.defects.filter(d => nativeKeys.has(controlledDefect(d).id)).map(d => d.id);
    review.defects = review.defects.filter(d => !nativeKeys.has(controlledDefect(d).id));
    review.disputedIds = review.disputedIds?.filter(id => !nativeKeys.has(id) && !duplicateIds.includes(id));
    review.defects.push(...bounds.map(f => ({ id: fingerprint([f.objectId, f.invariant]).slice(0,32), invariant: f.invariant, objectId: f.objectId, owner: "schema" as const, category: "text-bound", targets: f.paths, evidence: f.message, acceptance: "Shorten this field to its native maximum with complete sentences or valid complete mathematics, preserving the scientific meaning.", sourceIds: [] })));
    if (review.adjudications?.length) {
      if (!review.refresh) throw new RepairFailure("schema", "Adjudication requires a fresh full review.");
      for (const receipt of review.adjudications) {
        if (receipt.candidate !== hash || receipt.binding !== binding || !receipt.support.length || !receipt.rationale.trim()
          || receipt.support.some(s => !s.passage.trim() || !receipt.defect.sourceIds.includes(s.sourceId))) throw new RepairFailure("schema", "Invalid adjudication receipt.");
        const previous = ledger.get(receipt.defect.id);
        ledger.set(receipt.defect.id, { ...receipt.defect, occurrences: previous?.occurrences || 1, status: "disputed", adjudication: receipt });
      }
      await adapters.record(`adjudication-${round}-${refreshes}`, review.adjudications);
    }
    if (review.refresh) {
      for (const raw of review.defects) {
        const defect = controlledDefect(raw), previous = ledger.get(defect.id);
        if (defect.targets.some(t => !catalog.some(c => c.path === t))) throw new RepairFailure("schema", "Refresh supplied an unavailable target.");
        ledger.set(defect.id, { ...previous, ...defect, status: "open", occurrences: previous?.occurrences || 1 });
      }
      if (++refreshes > 4) throw new RepairFailure("content", "Evidence/adjudication review refresh bound exhausted.", [...ledger.values()], round);
      await adapters.record(`evidence-refresh-${round}-${refreshes}`, { fingerprint: hash, binding, review });
      continue; // Sources changed or a disputed demand needs a fresh review; no content edit consumed.
    }
    const verified = new Map<string, Verification>();
    for (const check of review.verified) {
      if (verified.has(check.id) || !context.obligations.some(d => d.id === check.id) || !check.evidence.trim())
        throw new RepairFailure("schema", "Invalid defect verification.", [...ledger.values()], round);
      const obligation = context.obligations.find(d => d.id === check.id);
      if (check.resolution === "replacement" && (!obligation?.replacement || !["renderer", "representation"].includes(obligation.owner)))
        throw new RepairFailure("schema", "Replacement verification needs an adopted artifact replan.", [...ledger.values()], round);
      if (check.resolution === "adjudication" && (!obligation?.adjudication || obligation.adjudication.candidate !== hash || obligation.adjudication.binding !== binding || review.defects.some(d => d.id === check.id)))
        throw new RepairFailure("schema", "Adjudication resolution lacks current proof and a passing fresh review.", [...ledger.values()], round);
      if (check.resolved && obligation?.adjudication && obligation.adjudication.candidate === hash && check.resolution !== "adjudication") throw new RepairFailure("schema", "Unchanged adjudicated demand requires explicit current adjudication verification.");
      verified.set(check.id, check);
    }
    for (const obligation of context.obligations) {
      const check = verified.get(obligation.id);
      obligation.status = check?.resolved ? "resolved" : check ? "open" : "disputed";
      obligation.verification = check?.evidence;
    }
    const findings = [...review.defects];
    if (rejectedPatch) findings.push(rejectedPatch);
    rejectedPatch = undefined;
    const unique = new Map<string, RepairDefect>();
    for (const raw of findings) {
      const defect = controlledDefect(raw), duplicate = unique.get(defect.id);
      if (duplicate) {
        if (defect.owner !== duplicate.owner)
          throw new RepairFailure("schema", "Review gave contradictory defect ownership or targets.", [...ledger.values()], round);
        unique.set(defect.id, defectSchema.parse({ ...defect, targets: [...new Set([...duplicate.targets, ...defect.targets])],
          evidence: [...new Set([duplicate.evidence, defect.evidence])].join("\n"),
          acceptance: [...new Set([duplicate.acceptance, defect.acceptance])].join("\n"),
          sourceIds: [...new Set([...duplicate.sourceIds, ...defect.sourceIds])],
        }));
      } else unique.set(defect.id, defect);
    }
    for (const defect of unique.values()) {
      const previous = ledger.get(defect.id);
      if (defect.artifact && (!/^\/(?:content|scene|figures\/\d+)$/.test(defect.artifact) || !catalog.some(t => t.path.startsWith(defect.artifact + "/"))))
        throw new RepairFailure("schema", "Reviewer named an unavailable artifact.", [...ledger.values()], round);
      if (defect.targets.some(path => !catalog.some(t => t.path === path))) throw new RepairFailure("schema", "Reviewer named an unavailable repair target.", [...ledger.values()], round);
      ledger.set(defect.id, { ...defect, replacement: previous?.replacement, status: previous ? "recurring" : "open", occurrences: (previous?.occurrences || 0) + 1 });
    }
    for (const id of review.disputedIds ?? []) { const raw = review.defects.find(d => d.id === id); const entry = ledger.get(raw ? controlledDefect(raw).id : id); if (entry) entry.status = "disputed"; }
    const open = [...ledger.values()].filter(d => d.status !== "resolved");
    // Editors and adoption audits must see this review's newly registered defects.
    context.obligations = open; context.history = [...ledger.values()];
    await adapters.record(`review-${round}`, { fingerprint: hash, binding, review, ledger: [...ledger.values()] });
    await adapters.checkpoint?.({ candidate, ledger: [...ledger.values()], round, replanned, seen: [...seen] });
    if (!open.length && review.complete) { schema().parse(candidate); adapters.validate(candidate); return { candidate, ledger: [...ledger.values()], rounds: round }; }
    if (!open.length) throw new RepairFailure("execution", "Incomplete final review.", [...ledger.values()], round);
    if (round === adapters.maxRepairs) throw new RepairFailure(open[0].owner, "Repair budget exhausted with unresolved findings.", [...ledger.values()], round);
    // A rejected proposal is bookkeeping, not a new candidate defect. It must not
    // hide a repeated unchanged repair and prevent the one bounded fallback.
    const actionable = open.filter(d => d.status !== "disputed" && (d.sourceProof || !d.category.startsWith("source-dispute")));
    if (!actionable.length) throw new RepairFailure("content", "Only unresolved source disputes remain.", open, round);
    const signature = fingerprint(actionable.filter(d => d.category !== "invalid-patch").map(d => [d.id, d.targets]).sort()), repeats = seen.has(`${hash}:${signature}`);
    seen.add(`${hash}:${signature}`);
    const needsReplan = adapters.allowRepresentationFallback !== false && (repeats || actionable.some(d => ["representation", "renderer"].includes(d.owner)) || actionable.some(d => d.occurrences >= 2 && d.targets.length === 0));
    if (open.some(d => d.owner === "execution")) throw new RepairFailure("execution", "Execution interrupted.", [...ledger.values()], round);
    // Reserve the attempt before any model call; interrupted work cannot reset its budget.
    round++;
    await adapters.checkpoint?.({ candidate, ledger: [...ledger.values()], round, replanned: replanned || needsReplan, seen: [...seen] });
    try {
      if (needsReplan) {
        if (replanned) throw new RepairFailure("representation", "Representation fallback exhausted.", [...ledger.values()], round);
        replanned = true;
        const replacement = await adapters.replan(candidate, actionable, context);
        const previous = candidate;
        candidate = await checkedPatch(candidate, replacement.targets, replacement.patch, context, replacement.validate);
        replacement.adopt?.();
        for (const defect of open) if (["renderer", "representation"].includes(defect.owner) && defect.artifact && replacement.targets.some(t => t.path === defect.artifact)) {
          const before = valueAt(previous, defect.artifact), after = valueAt(candidate, defect.artifact);
          const kind = (artifact: unknown) => { const value = artifact as { kind?: string; illustration?: { panels: { kind: string }[] } }; return [value?.kind, value?.illustration?.panels.map(p => p.kind).join(",")].filter(Boolean).join(":") || "flow"; };
          defect.replacement = { artifact: defect.artifact, before: fingerprint(before), after: fingerprint(after), round, beforeKind: kind(before), afterKind: kind(after) };
        }
        await adapters.record(`replan-${round}`, { targets: replacement.targets.map(t => t.path), fingerprint: fingerprint(candidate) });
      } else {
        const paths = [...new Set(actionable.flatMap(d => d.targets))];
        if (!paths.length) throw new RepairFailure("schema", "Content review supplied no editable targets.", [...ledger.values()], round);
        const targets = catalog.filter(t => paths.includes(t.path));
        // An owning-array replacement supersedes its element targets, avoiding overlapping writes.
        const minimal = targets.filter(t => !targets.some(parent => t.path.startsWith(parent.path + "/")));
        const patch = await adapters.edit(candidate, minimal, actionable, context);
        candidate = await checkedPatch(candidate, minimal, patch, context);
        await adapters.record(`patch-${round}`, { targets: minimal.map(t => t.path), fingerprint: fingerprint(candidate) });
      }
    } catch (error) {
      if (error instanceof RepairFailure && ["execution", "renderer", "representation"].includes(error.owner)) throw new RepairFailure(error.owner, error.message, [...ledger.values()], round);
      if (error instanceof RepairFailure && error.ledger.length) throw error;
      if (!(error instanceof z.ZodError) && !(error instanceof RepairFailure)) throw error;
      rejectedPatch = { id: "invalid-patch", owner: "schema", category: "invalid-patch", targets: [...new Set(actionable.flatMap(d => d.targets))].slice(0, 24), sourceIds: [], evidence: "The prior candidate is retained. Correct this private patch validation failure: " + error.message.slice(0, 3000), acceptance: "Supply a valid, changed patch for the existing unresolved targets, respecting their constraints." };
      await adapters.record(`rejected-patch-${round}`, { reason: error instanceof Error ? error.message.slice(0, 4000) : "Invalid patch", owner: error instanceof RepairFailure ? error.owner : "schema", candidateFingerprint: hash });
    }
    refreshes = 0;
  }
  throw new RepairFailure("execution", "Repair controller ended unexpectedly.");
  async function checkedPatch(previous: T, targets: Target[], patch: unknown, context: RepairContext, validate = adapters.validate) {
    const next = applyPatch(previous, schema(), targets, patch);
    if (adapters.inspect && validate === adapters.validate) {
      const before = [...textBoundFindings(previous, schema()), ...adapters.inspect(previous)], after = [...textBoundFindings(next, schema()), ...adapters.inspect(next)];
      if (!validationProgress(before, after, changedFieldPaths(previous,next).map(path=>({path})))) {
        await adapters.record(`validation-rejected-${context.round}`, { before, after, targets: targets.map(t => t.path) });
        throw new RepairFailure("schema", after.map(f => `${f.objectId}/${f.invariant}: ${f.message}`).join("; ").slice(0, 4000));
      }
    } else {
      try { validate(next); }
      catch (error) { throw new RepairFailure("schema", error instanceof Error ? error.message : "Patched candidate failed deterministic validation."); }
    }
    await adapters.auditPatch?.(previous, next, targets, context);
    return next;
  }
}
