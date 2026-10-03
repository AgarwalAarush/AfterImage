import { z } from "zod";
import type { Source } from "../src/lib/types";
import { fingerprint, RepairFailure, valueAt } from "./repair-controller";
import { candidateSpan, candidateTextSpans, candidateSpanSelection, type CandidateSpan } from "./exact-spans";
import { passageSelection } from "./evidence";

type Equation = { latex: string; explanation: string; sourceId: string };
export type RelationScope = CandidateSpan & { index: number; equation: string; parent: string };
/** Lexical boundaries bind review scope; this is not a mathematical parser or scientific verdict. */
function boundaries(text: string, additive: boolean): [number, number][] {
  const ranges: [number, number][] = []; let start = 0, braces = 0, parentheses = 0, environments = 0;
  for (let i = 0; i < text.length; i++) {
    const command = text.slice(i).match(/^\\(begin|end)\{[^}]+\}/);
    if (command) { environments += command[1] === "begin" ? 1 : -1; i += command[0].length - 1; continue; }
    const escaped = i > 0 && text[i - 1] === "\\";
    if (!escaped && text[i] === "{") braces++;
    else if (!escaped && text[i] === "}") braces--;
    else if (!escaped && (text[i] === "(" || text[i] === "[")) parentheses++;
    else if (!escaped && (text[i] === ")" || text[i] === "]")) parentheses--;
    if (braces || parentheses || environments) continue;
    const separator = additive ? (text[i] === "+" ? "+" : undefined) : text.slice(i).match(/^(?:,|;|\\(?:qquad|quad)\b|\\\\)/)?.[0];
    if (separator) { if (text.slice(start, i).trim()) ranges.push([start, i]); start = i + separator.length; i = start - 1; }
  }
  if (text.slice(start).trim()) ranges.push([start, text.length]);
  return ranges;
}
export function equationRelationScopes(candidate: unknown, equations: Equation[], root: string): RelationScope[] {
  if (equations.length > 5) throw new RepairFailure("schema", "Equation provenance exceeds native bound.");
  return equations.flatMap((equation, index) => {
    const path = `${root}/${index}/latex`, digest = fingerprint(equation);
    if (fingerprint(valueAt(candidate, `${root}/${index}`)) !== digest) throw new RepairFailure("schema", "Equation relation input differs from the current candidate.");
    const scopes = boundaries(equation.latex, false).flatMap(([start, end]) => {
      const parent = fingerprint([path, start, end, equation.latex.slice(start, end)]);
      return boundaries(equation.latex.slice(start, end), true).map(([a, b]) => ({ ...candidateSpan(candidate, path, start + a, start + b), index, equation: digest, parent }));
    });
    if (!scopes.length || scopes.length > 48) throw new RepairFailure("schema", "Equation relation coverage exceeds its bounded catalogue.");
    return scopes;
  });
}
export const relationProvenancePrompt = "Independently audit EVERY supplied RELATION SCOPE, including separate additive terms of a composite equation. Classify each as author, derived or implementation. Compare its exact source equation and same-version implementation, dimensions, normalization and exceptional branches. Select exact candidate attribution span IDs and supplied source passage IDs; never transcribe quotes. An implementation interpretation needs its OWN explicit attribution naming that relation; a disclosure about another term, another equation, or a generic derived compression cannot certify it. Derived notation needs its own applicable disclosure. Author display disagreement remains a scientific failure even if the implementation computes useful numbers. attributionApplicable is your independent judgment that the selected candidate text explicitly discloses this precise scope's origin; never infer it merely from proximity or selected IDs. A structural receipt is not scientific approval. passed requires source fidelity and correct applicable attribution. Use failureKind:none only for a pass, attribution for disclosure-only failure, and source-fidelity when the mathematics/source interpretation itself is wrong. On failure report a targeted repair finding; do not invent a corrected author equation.";
export function relationReviewContract(candidate: unknown, equations: Equation[], root: string, binding: string, sources: Source[], indices?: number[]) {
  if (!sources.length || sources.length > 14 || new Set(sources.map(s => s.id)).size !== sources.length) throw new RepairFailure("schema", "Relation evidence must be a supplied bounded context.");
  const currentScopes = () => equationRelationScopes(candidate, equations, root).filter(s=>!indices || indices.includes(s.index));
  const scopes = currentScopes(), text = candidateSpanSelection(candidate), proof = passageSelection(sources);
  const schema = z.object({ candidate: z.literal(fingerprint(candidate)), binding: z.literal(binding), sources: z.literal(fingerprint(sources)), scopes: z.literal(fingerprint(scopes)),
    relations: z.array(z.object({ relationId: scopes.length ? z.enum(scopes.map(s => s.id) as [string, ...string[]]) : z.never(), origin: z.enum(["author", "derived", "implementation"]), attributionSpanIds: z.array(text.spans.length ? z.enum(text.spans.map(s=>s.id) as [string,...string[]]) : z.never()).max(4), attributionApplicable: z.boolean(), passageIds: proof.ids, passed: z.boolean(), failureKind: z.enum(["none", "attribution", "source-fidelity"]), reason: z.string().min(1).max(1600) })).length(scopes.length) });
  const validate = (raw: unknown) => {
    const review = schema.parse(raw);
    if (review.candidate !== fingerprint(candidate) || review.sources !== fingerprint(sources) || review.scopes !== fingerprint(currentScopes())) throw new RepairFailure("schema", "Stale relation provenance context.");
    if (new Set(review.relations.map(r => r.relationId)).size !== scopes.length) throw new RepairFailure("schema", "Incomplete or duplicate relation provenance coverage.");
    const receipts = review.relations.map(relation => {
      if (relation.passed !== (relation.failureKind === "none")) throw new RepairFailure("schema", "Relation verdict and rejection scope disagree.");
      const scope = scopes.find(s => s.id === relation.relationId)!;
      candidateSpanSelection(candidate, scopes).resolve([scope.id]);
      const attribution = relation.attributionSpanIds.length ? text.resolve(relation.attributionSpanIds) : [];
      if (attribution.some(s => !s.path.startsWith(`${root}/${scope.index}/`) || s.path.endsWith("/latex"))) throw new RepairFailure("schema", "Relation attribution borrowed from another equation or its formula.");
      const support = proof.resolve(relation.passageIds);
      const disclosure = attribution.map(s=>s.text).join("\n");
      if (relation.passed && relation.origin === "implementation" && !/\b(?:implementation|listing|code|algorithm)\b/i.test(disclosure)) throw new RepairFailure("content", "Implementation relation lacks explicit candidate attribution.");
      if (relation.passed && relation.origin === "derived" && !/\b(?:derived|derivation|explanatory|shorthand|reformulation)\b/i.test(disclosure)) throw new RepairFailure("content", "Derived relation lacks explicit candidate disclosure.");
      if (relation.passed && !relation.attributionApplicable) throw new RepairFailure("content", "Relation provenance lacks applicable candidate attribution.");
      return { ...relation, version: 1, candidate: review.candidate, binding: review.binding, sources: review.sources, sourceIds: sources.map(s => s.id), scopes: review.scopes, scope, attribution, support };
    });
    return { review, receipts };
  };
  return { scopes, spans: candidateTextSpans(candidate).filter(s => new RegExp(`^${root}/\\d+/(?:explanation|example|title)$`).test(s.path)), schema, validate };
}

/** Replay validation never turns an origin receipt into source approval. */
export function validateRelationReceipts(receipts: ReturnType<ReturnType<typeof relationReviewContract>["validate"]>["receipts"], candidate: unknown, equations: Equation[], root: string, binding: string, sources: Source[], indices?: number[]) {
  const contract=relationReviewContract(candidate,equations,root,binding,sources,indices);
  if(!receipts.length&&contract.scopes.length)throw new RepairFailure("schema","Missing relation provenance receipts.");
  const first=receipts[0];
  const raw={candidate:first?.candidate??fingerprint(candidate),binding:first?.binding??binding,sources:first?.sources??fingerprint(sources),scopes:first?.scopes??fingerprint(contract.scopes),relations:receipts.map(({relationId,origin,attributionSpanIds,attributionApplicable,passageIds,passed,failureKind,reason})=>({relationId,origin,attributionSpanIds,attributionApplicable,passageIds,passed,failureKind,reason}))};
  const verified=contract.validate(raw);
  if(fingerprint(receipts)!==fingerprint(verified.receipts))throw new RepairFailure("schema","Altered relation provenance receipt.");
  return verified;
}

export function relationProvenanceFailures(receipts: ReturnType<ReturnType<typeof relationReviewContract>["validate"]>["receipts"]) {
  return receipts.filter(r=>!r.passed).map(receipt=>({
    invariant:"relation-provenance",objectId:`equation-${receipt.scope.index}/scope-${fingerprint([receipt.scope.path,receipt.scope.startByte,receipt.scope.endByte]).slice(0,16)}`,
    owner:"content" as const,targets:receipt.failureKind==="source-fidelity"?[receipt.scope.path,receipt.scope.path.replace(/\/latex$/,"/explanation")]:[receipt.scope.path.replace(/\/latex$/,"/explanation")],sourceIds:[...new Set(receipt.support.map(s=>s.sourceId))],
    evidence:receipt.reason+"\nExact relation scope: "+receipt.scope.text,
    acceptance:`Independently correct this exact ${receipt.origin} relation${receipt.failureKind==="source-fidelity"?" and its dependent explanation against the received source":" attribution without changing its mathematics"}. Preserve every unaffected mathematical term, claim, equation and dependency.`
  }));
}
