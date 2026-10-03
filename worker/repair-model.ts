import { relationReviewContract, relationProvenancePrompt } from "./equation-provenance";
import { candidateSchema } from "./text-bounds";
import type { ResearchBundle } from "../src/lib/research-bundle";
import { z } from "zod";
import { validateScientificAuthority, scientificFinding, passageSelection, passageSourceText } from "./evidence";
import { technicalReviewSchema } from "./quality";
import { critiqueSchema } from "./diagram-review";
import { RepairFailure, defectOwnerSchema, fingerprint, patchSchema, canonicalizeDefects, type Target, type RepairContext, type RepairDefect, type Verification } from "./repair-controller";

const targeting = {
  targets: z.array(z.string().max(300)).max(24),
  owner: defectOwnerSchema.nullable(),
  acceptance: z.string().max(4000).nullable(),
  artifact: z.string().max(300).nullable(),
  sourceIds: z.array(z.string()).max(14),
};
const targetedCheck = technicalReviewSchema.shape.contribution.extend(targeting);
export const targetedTechnicalSchema = technicalReviewSchema.extend(Object.fromEntries(Object.keys(technicalReviewSchema.shape).map(key => [key, targetedCheck])) as Record<keyof typeof technicalReviewSchema.shape, typeof targetedCheck>);
export const targetedVisualSchema = critiqueSchema.extend({ issues: z.array(critiqueSchema.shape.issues.element.extend(targeting)).max(16) });
export function reviewTargets(context: RepairContext) {
  const paths = context.catalog.map(t => t.path);
  return paths.length ? z.array(z.enum(paths as [string, ...string[]])).max(24) : z.array(z.never()).max(0);
}
export function reviewCitations(sourceIds?: string[]) {
  return sourceIds === undefined ? z.array(z.string()).max(14) : sourceIds.length ? z.array(z.enum(sourceIds as [string, ...string[]])).max(14) : z.array(z.never()).max(0);
}
export function technicalSchemaFor(context: RepairContext, sourceIds?: string[]) {
  const check = targetedCheck.extend({ targets: reviewTargets(context), sourceIds: reviewCitations(sourceIds) });
  return targetedTechnicalSchema.extend(Object.fromEntries(Object.keys(technicalReviewSchema.shape).map(key => [key, check])) as Record<keyof typeof technicalReviewSchema.shape, typeof check>);
}
export function visualSchemaFor(context: RepairContext, sourceIds?: string[]) {
  return targetedVisualSchema.extend({ issues: z.array(critiqueSchema.shape.issues.element.extend({ ...targeting, targets: reviewTargets(context), sourceIds: reviewCitations(sourceIds) })).max(16) });
}
export const equationAuditSchema = z.object({
  index: z.number().int().min(0).max(4), fingerprint: z.string().length(64),
  origin: z.enum(["source", "derived", "implementation"]), definitionEvidence: z.string().min(1).max(2400),
  symbols: z.array(z.object({ symbol: z.string().min(1).max(100), definition: z.string().min(1).max(500), resultPassage: z.string().min(1).max(800) })).min(1).max(24),
  verdict: z.enum(["pass", "fail"]), repair: z.string().max(2000), ...targeting,
  sourceIds: z.array(z.string()).min(1).max(14),
  sourceSupport: z.array(z.object({ sourceId: z.string(), passage: z.string().min(1).max(1800) })).min(1).max(8),
});
export type Model = <T>(prompt: string, schema: z.ZodType<T>, name: string, images?: string[]) => Promise<T>;
export function targetDescription(catalog: Target[]) {
  return catalog.map(t => {
    const outer = t.constraints as Record<string, unknown>;
    const schema = (Array.isArray(outer.anyOf) ? outer.anyOf.find((s: Record<string, unknown>) => s.type !== "null") : outer) as Record<string, unknown>;
    return { path: t.path, type: schema.type, maxLength: schema.maxLength, minItems: schema.minItems, maxItems: schema.maxItems, description: schema.description, variants: outer.oneOf ?? outer.anyOf };
  });
}
export function nativeTargetViability(target: Target, requiredValue: unknown): boolean { return target.schema.safeParse(requiredValue).success; }
export type NativeRequiredValue = { target: string; value: string };
function nativeGlyphOwnerAccepts(target: Target, requiredValue: string): boolean {
 let schema: any = target.schema;
 while (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable || schema instanceof z.ZodDefault) schema = schema.unwrap();
 if (!(schema instanceof z.ZodDiscriminatedUnion) || schema.def.discriminator !== "glyph") return false;
 // Preserve received shared fields. Only promote when a native glyph variant can visibly encode the complete operand.
 return schema.options.some((option: any) => option instanceof z.ZodObject && option.shape.glyph instanceof z.ZodLiteral && option.shape.label?.safeParse(requiredValue).success && option.safeParse({ ...(target.value as object), glyph: option.shape.glyph.value, label: requiredValue }).success);
}
/** Promote an infeasible exact value before identity reconciliation and scientific adjudication. */
export function viableNativeFinding<T extends { owner: string; targets: string[]; dependencies?: string[]; evidence: string; acceptance: string; artifact?: string | null; requiredValues?: NativeRequiredValue[] }>(finding: T, context: RepairContext): T {
 let targets=[...finding.targets];
 for(const required of finding.requiredValues??[]) {
  const leaf=context.catalog.find(t=>t.path===required.target);
  if(!leaf||!finding.targets.includes(required.target))throw new RepairFailure("schema","Exact correction names an unbound native target.");
  if(nativeTargetViability(leaf,required.value))continue;
  const owner=context.catalog.filter(t=>required.target.startsWith(t.path+"/")&&nativeGlyphOwnerAccepts(t,required.value)).sort((a,b)=>b.path.length-a.path.length)[0];
  if(!owner)return {...finding,owner:"representation",targets:[],artifact:finding.artifact??"/content",acceptance:finding.acceptance+"\nPreserve these exact minimum corrections: "+JSON.stringify(finding.requiredValues),evidence:finding.evidence+"\nThe complete required value exceeds its native target; a bounded representation correction is necessary.\nExact minimum corrections: "+JSON.stringify(finding.requiredValues)};
  targets=targets.filter(path=>!path.startsWith(owner.path+"/"));targets.push(owner.path);
 }
 const unique=[...new Set(targets)];
 return {...finding,targets:unique.filter(path=>!unique.some(parent=>parent!==path&&path.startsWith(parent+"/"))),acceptance:finding.acceptance+(finding.requiredValues?.length?"\nPreserve these exact minimum corrections: "+JSON.stringify(finding.requiredValues):""),evidence:finding.evidence+(finding.requiredValues?.length?"\nExact minimum corrections: "+JSON.stringify(finding.requiredValues):"")};
}
export function targetingPrompt(context: RepairContext) {
  return "\nTARGET CATALOG:\n" + JSON.stringify(targetDescription(context.catalog)) +
    "\nFor every failure name only exact target paths from this catalog, including necessary dependencies. Prefer one label, one equation explanation, or a specific prose field; never select unrelated fields. Supply an acceptance condition and owner: content for semantic/text edits, representation only for an infeasible example/primitive change; missing operand arrows, incorrect labels and source claims use content when native fields can express the correction, renderer for unsupported geometry, schema for malformed data, execution for interrupted work. A renderer/representation finding may have no editable target, but MUST identify its affected artifact as /scene or /figures/INDEX (zero-based). artifact locates an object for a bounded replan; it does not authorize a normal replacement. Content findings may use artifact:null. Passes/suggestions use targets:[], owner:null, acceptance:null, artifact:null. Check field limits before proposing a correction. For an exact operand or notation correction include requiredValues with its target and complete minimum string; never abbreviate a required operand to fit. Use the smallest owning native union object for a primitive/discriminator change, retaining its identity and unaffected fields. Immutable discriminator leaves are not editable. If no native owner can express the complete correction, mark representation ownership instead of spending an impossible edit. Scientific failures require supplied source IDs; exact supporting passages are adjudicated separately before edits. Later coverage expansions must identify a missed PLAN requirement or concrete scientific defect; optional elaboration is a suggestion. Keep short units such as token slots; put full explanations in captions.\nCURRENT CANDIDATE FINGERPRINT: " + context.fingerprint + "\nREVIEW INPUT BINDING: " + (context.binding || context.fingerprint) + "\nCURRENT ADJUDICATION RECEIPTS (recheck the exact source proof; do not repeat an unsupported preference):\n" + JSON.stringify(context.adjudications || []);
}
export function finding(category: string, detail: { targets?: string[]; owner?: string | null; artifact?: string | null; evidence: string; acceptance?: string | null; repair?: string; sourceIds?: string[] }, context: RepairContext): RepairDefect {
  const targets = detail.targets || [];
  if (targets.some(path => !context.catalog.some(t => t.path === path))) throw new RepairFailure("schema", "Review names an unknown target.");
  return {
    id: fingerprint([category, targets, detail.artifact || null]).slice(0, 32), category, owner: defectOwnerSchema.parse(detail.owner || "content"), artifact: detail.artifact, targets,
    evidence: detail.evidence, acceptance: detail.acceptance || detail.repair || "Correct the cited defect against its source and verify the affected representation.", sourceIds: detail.sourceIds || [],
  };
}
export function parseModelOutput<T>(raw: string, schema: z.ZodType<T>, privateDraft = false): T {
  // Only remove a received Markdown wrapper; never infer missing semantic fields or repair values.
  const trimmed = raw.trim(), fenced = /^```(?:json)?\s*\n([\s\S]*)\n```$/.exec(trimmed);
  try { return (privateDraft ? candidateSchema(schema) : schema).parse(JSON.parse(fenced ? fenced[1] : trimmed)); }
  catch { throw new RepairFailure("schema", "Model output did not match its bounded schema."); }
}
export async function verifyObligations(model: Model, candidate: unknown, context: RepairContext, sourceContext: string, images?: string[]): Promise<Verification[]> {
  if (!context.obligations.length) return [];
  const id = z.enum(context.obligations.map(d => d.id) as [string, ...string[]]);
  const schema = z.object({ candidate: z.literal(context.fingerprint), binding: z.literal(context.binding || context.fingerprint), checks: z.array(z.object({ id, resolved: z.boolean(), resolution: z.enum(["same-representation", "replacement", "adjudication"]), evidence: z.string().min(1).max(2000) })).length(context.obligations.length) });
  const verification = await model("Independently verify EVERY open defect against CURRENT RESULT, SOURCE DATA and the attached current rendered images when available. Use those images for visual acceptance conditions; encoded data alone cannot establish label/connector visibility. A new reviewer omitting a defect does not resolve it. For each resolved claim cite the exact changed result passage/object and source evidence or rendered encoding that satisfies its acceptance condition. If the target is unchanged and still wrong, return false. Only an obligation carrying a current candidate/binding adjudication receipt may use resolution:adjudication for a source-proven unsupported review demand after a fresh passing review. This cannot resolve a genuine defect. Independently check its exact source proof. Only ledger entries carrying replacement evidence came from an ADOPTED artifact replan. For those renderer/representation findings, resolution:replacement may verify that the new rendered representation coherently carries the source-supported meaning and passes current review, without requiring obsolete arrows or shapes from the prior plot kind. Never use replacement for an ordinary edit or a scientific content finding, and never resolve merely because a plot kind changed. Otherwise use resolution:same-representation. Do not accept a model's assertion that it repaired something.\nOBLIGATIONS:\n" + JSON.stringify(context.obligations) + "\nCURRENT RESULT:\n" + JSON.stringify(candidate) + "\nSOURCE DATA:\n" + sourceContext, schema, `verify-defects-${context.round}`, images);
  return verification.checks;
}
export async function requestEdit(model: Model, candidate: unknown, targets: Target[], defects: RepairDefect[], context: RepairContext, sourceContext: string, authoritySources?: ResearchBundle["sources"]) {
  if (defects.some(scientificFinding)) validateScientificAuthority(defects, authoritySources ?? JSON.parse(sourceContext.split("\n")[0]).sources, context);
  const schema = patchSchema(targets, context.fingerprint);
  return model("Edit CURRENT RESULT only at the supplied targets. Return replacement values in t0,t1,..., with the exact base and preimage fingerprints. Preserve all other native fields exactly. Within a targeted text field, change the smallest clauses needed and preserve the meaning of every unaffected claim; do not add optional elaboration. When adding to an owning array, copy unrelated existing entries exactly. Do not rewrite an array to fix a single element unless the target explicitly permits the whole array. Coordinate dependent symbol definitions/examples/quiz answers only when explicitly targeted. Text must be COMPLETE and fit its native schema; shorten wording rather than truncate clauses. Correct actual source fidelity, not just a reviewer's wording.\nTARGETS:\n" + JSON.stringify(targets.map((t, i) => ({ key: `t${i}`, path: t.path, preimage: t.fingerprint, value: t.value, constraints: t.constraints }))) + "\nBASE: " + context.fingerprint + "\nDEFECTS:\n" + JSON.stringify(defects) + "\nCURRENT RESULT:\n" + JSON.stringify(candidate) + "\nSOURCE DATA:\n" + sourceContext, schema, `edit-${context.round}`);
}

/** Resolve ownership before broadening a repair; this never changes scientific acceptance criteria. */
export async function assessRepresentationEdits(model: Model, candidate: unknown, defects: RepairDefect[], context: RepairContext, sourceContext: string): Promise<RepairDefect[]> {
  const grouped = new Map<string, RepairDefect>();
  for (const defect of defects.filter(d => d.owner === "representation")) {
    const previous = grouped.get(defect.id);
    grouped.set(defect.id, previous ? { ...defect, acceptance: [...new Set([previous.acceptance, defect.acceptance])].join("\n"), evidence: [...new Set([previous.evidence, defect.evidence])].join("\n") } : defect);
  }
  const representation = [...grouped.values()];
  if (!representation.length) return defects;
  const ids = z.enum(representation.map(d => d.id) as [string, ...string[]]);
  const schema = z.object({ binding: z.literal(context.binding || context.fingerprint), decisions: z.array(z.object({ id: ids, action: z.enum(["edit", "replan"]), targets: reviewTargets(context), rationale: z.string().min(1).max(2000) })).length(representation.length) });
  const response = await model("Assess ONLY whether each representation finding truly needs a new representation or can be fixed by existing native field edits. Missing operand connections, wrong short labels, citations and source claims are content edits when a legal field/array patch can express the complete correction. Replan only if the required proof cannot fit the native schema or needs a different panel kind or violates the preflighted identity/assignment contract. Respect the supplied shared example contract. Do not change or waive the original acceptance conditions, source requirements or gates. For edit name all exact catalog paths needed to satisfy the WHOLE original condition; for replan use targets:[]. A geometry-only renderer change is not a content edit.\nFINDINGS:\n" + JSON.stringify(representation) + targetingPrompt(context) + "\nCURRENT RESULT:\n" + JSON.stringify(candidate) + "\nSOURCE AND CAPABILITY DATA:\n" + sourceContext, schema, `repair-feasibility-${context.round}`);
  const decisions = new Map(response.decisions.map(d => [d.id, d]));
  if (decisions.size !== representation.length) throw new RepairFailure("schema", "Incomplete representation feasibility assessment.");
  return defects.map(defect => {
    const decision = decisions.get(defect.id);
    if (!decision || decision.action === "replan") return defect;
    if (!decision.targets.length || decision.targets.some(path => !context.catalog.some(t => t.path === path))) throw new RepairFailure("schema", "Invalid native edit feasibility targets.");
    return { ...defect, owner: "content" as const, targets: decision.targets };
  });
}

/** Audit only changed mathematics, before adoption. The subsequent complete review is still mandatory. */
export async function auditEquationPatch(model: Model, previous: unknown, proposed: unknown, targets: Target[], context: RepairContext, sourceText: string) {
  const math = (value: any) => value?.recall?.equations || [];
  const before = math(previous), after = math(proposed);
  const changed = Array.from({ length: Math.max(before.length, after.length) }, (_, index) => ({ index, eq: after[index] ?? null, previous: before[index] ?? null, fingerprint: fingerprint(after[index] ?? null) })).filter(entry => fingerprint(before[entry.index] ?? null) !== entry.fingerprint);
  if (!changed.length) return;
  const data = JSON.parse(sourceText) as { sources: { id: string; label: string; url: string; excerpt: string }[] };
  const selection = passageSelection(data.sources);
  const schema = z.object({ candidate: z.literal(fingerprint(proposed)), binding: z.literal(context.binding!), audits: z.array(equationAuditSchema.omit({ sourceSupport: true, sourceIds: true }).extend({ passageIds: selection.ids, targets: reviewTargets(context) })).length(changed.length) });
  const response = await model("Before adoption, independently audit every changed equation, explanation and dependent example. Check exact source/implementation support, exceptional null/empty/zero branches, normalization and dimensions, training proxies versus executed work, provenance of reformulations and dependencies elsewhere in RESULT. Do not accept a repair assertion or a reviewer demand as source evidence. Return the received equation index/fingerprint. Reject unsupported new mathematics.\nCHANGED EQUATIONS:\n" + JSON.stringify(changed) + "\nPROPOSED RESULT:\n" + JSON.stringify(proposed) + "\nSOURCE DATA:\n" + passageSourceText(sourceText), schema, `patch-equations-${context.round}`);
  const seen = new Set<number>();
  for (const audit of response.audits) {
    const expected = changed.find((c: { index: number }) => c.index === audit.index);
    if (!expected || seen.has(audit.index) || expected.fingerprint !== audit.fingerprint) throw new RepairFailure("schema", "Stale or incomplete proposed equation audit.");
    seen.add(audit.index);
    for (const support of selection.resolve(audit.passageIds)) {
      const source = data.sources.find(s => s.id === support.sourceId);
      if (!source || !source.excerpt.replace(/\s+/g, " ").includes(support.passage.replace(/\s+/g, " "))) throw new RepairFailure("schema", "Proposed equation audit lacks exact source proof.");
    }
    if (audit.verdict === "fail") throw new RepairFailure("content", "Proposed mathematics failed source/edge-case audit.");
  }
  const indices=changed.filter(entry=>entry.eq!==null).map(entry=>entry.index);
  if(indices.length){
    const provenance=relationReviewContract(proposed,after,"/recall/equations",context.binding!,data.sources,indices);
    const received=await model(relationProvenancePrompt+"\nRELATION SCOPES:\n"+JSON.stringify(provenance.scopes)+"\nCANDIDATE ATTRIBUTION SPANS:\n"+JSON.stringify(provenance.spans)+"\nPROPOSED RESULT:\n"+JSON.stringify(proposed)+"\nSOURCE DATA:\n"+passageSourceText(sourceText),provenance.schema,`patch-relations-${context.round}`);
    const audited=provenance.validate(received);
    if(audited.receipts.some(receipt=>!receipt.passed))throw new RepairFailure("content","Proposed relation failed independent source/provenance review.");
  }
}

export async function auditSupplementPatch(model: Model, previous: unknown, proposed: unknown, targets: Target[], context: RepairContext, sourceText: string) {
  const data = JSON.parse(sourceText) as { sources: { id: string; label: string; url: string; excerpt: string }[] };
  const selection = passageSelection(data.sources);
  const schema = z.object({ candidate: z.literal(fingerprint(proposed)), binding: z.literal(context.binding!), verdict: z.enum(["pass", "fail"]), evidence: z.string().min(1).max(2000), passageIds: selection.ids });
  const response = await model("Before adopting this supplement patch, audit changed mathematics, figure quantities and quiz dependencies against exact source passages. Check exceptional null/empty branches, normalization, dimensions, correct answers AND distractor explanations. Do not invent unsupported detail or change other figures/questions. This semantic audit does not replace the final geometry, rendering, source and quiz reviews.\nTARGETS:\n" + JSON.stringify(targets.map(t => t.path)) + "\nPREVIOUS:\n" + JSON.stringify(previous) + "\nPROPOSED:\n" + JSON.stringify(proposed) + "\nSOURCE DATA:\n" + passageSourceText(sourceText), schema, `study-patch-audit-${context.round}`);
  for (const support of selection.resolve(response.passageIds)) {
    const source = data.sources.find(s => s.id === support.sourceId);
    if (!source || !source.excerpt.replace(/\s+/g, " ").includes(support.passage.replace(/\s+/g, " "))) throw new RepairFailure("schema", "Supplement patch audit lacks exact source proof.");
  }
  if (response.verdict === "fail") throw new RepairFailure("content", "Proposed supplement failed source/math dependency audit.");
}

/** Identity review cannot resolve or waive a finding; it only reuses controller IDs. */
export async function reconcileDefectIdentities(model: Model, findings: RepairDefect[], candidate: unknown, context: RepairContext): Promise<RepairDefect[]> {
  const history = context.history ?? context.obligations;
  const known = new Map(history.map(d => [d.id, d]));
  const owners = new Map<string,RepairDefect>(known);
  const ordered = [...findings].sort((a,b) => a.id.localeCompare(b.id) || (["content","representation","renderer","schema","execution"].indexOf(a.owner) - ["content","representation","renderer","schema","execution"].indexOf(b.owner)) || a.category.localeCompare(b.category));
  for (const d of ordered) if (!owners.has(d.id)) owners.set(d.id, d);
  const normalized = findings.map(d => ({ ...d, owner: owners.get(d.id)!.owner, category: owners.get(d.id)!.category }));
  const pending = canonicalizeDefects(normalized.filter(d => !known.has(d.id)), { discardProofs: true }).sort((a,b) => normalized.findIndex(d=>d.id===a.id) - normalized.findIndex(d=>d.id===b.id));
  if (!pending.length || (!history.length && pending.length < 2)) return normalized;
  if (history.length > 128 || pending.length > 64) throw new RepairFailure("schema", "Defect identity catalogue exceeded its bound");
  const mappings = Object.fromEntries(pending.map((_,i)=>{
    const prior=[...history.map(d=>d.id),...pending.slice(0,i).map(d=>d.id)];
    const sameAs=prior.length ? z.enum(prior as [string,...string[]]).nullable() : z.null();
    return [`f${i}`,z.object({sameAs,reason:z.string().min(1).max(1200)}).strict()];
  }));
  const result = await model("Reconcile defect IDENTITY only. A finding with renamed wording, category, object label, wider field localization or reordered array indices must reuse an existing controller-owned ID when it describes the SAME object and violated scientific invariant. Compare object content and acceptance conditions, not array positions. Include resolved history so a recurrence retains its identity. A genuinely different invariant on the same object remains new (sameAs=null). Never mark a defect resolved, approve content, drop requirements, or merge merely because targets overlap. Also coalesce duplicates within this review: each finding may reference an earlier finding ID, never itself or a later finding. Every new finding needs one decision. Return the exact candidate binding.\n"+JSON.stringify({candidate,fingerprint:context.fingerprint,history:history.map(d=>({id:d.id,objectId:d.objectId,invariant:d.invariant,targets:d.targets,evidence:d.evidence,acceptance:d.acceptance,status:d.status})),findings:Object.fromEntries(pending.map((d,i)=>[`f${i}`,d]))}),z.object({candidate:z.literal(context.fingerprint),mappings:z.object(mappings).strict()}).strict(),`defect-identities-${context.round}`);
  const canonical = new Map<string,RepairDefect>();
  pending.forEach((finding,i)=>{
    const choice=result.mappings[`f${i}`];
    const previous=choice.sameAs ? known.get(choice.sameAs) ?? canonical.get(choice.sameAs) : undefined;
    if(choice.sameAs&&!previous)throw new RepairFailure("schema","Unknown prior defect identity");
    canonical.set(finding.id,previous ? {...finding,id:previous.id,objectId:previous.objectId,invariant:previous.invariant,owner:previous.owner,category:previous.category,acceptance:[...new Set([previous.acceptance,finding.acceptance])].join("\n")} : finding);
  });
  return normalized.map(d=>canonical.get(d.id)??d);
}
