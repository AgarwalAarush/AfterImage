import { mkdir, readFile, rename, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { fingerprint, defectSchema } from "./repair-controller";
import { candidateSchema } from "./text-bounds";
import { componentIdSchema, sourceRegistrySchema } from "../src/lib/kit";
import { evidenceDecisionSchema, evidenceDecisionDigest, validateEvidenceDecision } from "./evidence";
import type { Source } from "../src/lib/types";

const hash = z.string().length(64);
const support = z.array(z.object({ sourceId: z.string().max(160), passage: z.string().min(1).max(1800) })).max(8);
const ledgerSchema = defectSchema.extend({ status: z.enum(["open", "resolved", "recurring", "disputed"]), occurrences: z.number().int().min(1).max(100), verification: z.string().max(4000).optional(),
  adjudication: z.object({ defect: defectSchema, candidate: hash, binding: hash, rationale: z.string().min(1).max(4000), support }).optional(),
  replacement: z.object({ artifact: z.string().max(300), before: hash, after: hash, round: z.number().int().min(0).max(4), beforeKind: z.string().max(160).optional(), afterKind: z.string().max(160).optional() }).optional() });
// The byte bound remains authoritative. These bounds permit cumulative private
// review history without silently pruning current or historical authority.
const repairSchema = z.object({ candidate: z.unknown(), ledger: z.array(ledgerSchema).max(4096), round: z.number().int().min(0).max(4), replanned: z.boolean(), seen: z.array(z.string().max(200)).max(40) }).strict();
const decisionSchema = evidenceDecisionSchema.extend({ receipt: z.object({ version: z.literal(1), candidate: hash, binding: hash, scope: hash, decision: hash, sources: hash, sourceIds: z.array(z.string().max(160)).min(1).max(14) }).strict() });
const checkpointSchema = z.object({ version: z.literal(1), binding: z.string().min(1).max(1000), componentId: z.string().min(1).max(100), candidate: z.unknown().optional(), repair: repairSchema.optional(),
  evidenceDecisions: z.array(z.tuple([hash, z.unknown()])).max(4096).optional(), sources: sourceRegistrySchema.optional(), focusedSources: sourceRegistrySchema.max(14).optional(), exhausted: z.boolean().optional() }).strict();
export type KitCheckpoint = z.infer<typeof checkpointSchema>;
export const kitRunSchema = z.object({ used: z.object({ opening: z.number().int().min(0).max(4), supplement: z.number().int().min(0).max(2) }).strict(),
  fallbacks: z.object({ opening: z.boolean(), supplement: z.boolean() }).strict(), enrichments: z.object({ opening: z.number().int().min(0).max(2), supplement: z.number().int().min(0).max(2) }).strict(),
  completed: z.array(componentIdSchema).max(6), completedRevisions: z.record(componentIdSchema, z.string().min(1).max(80)), started: z.array(componentIdSchema).max(6) }).strict();
export type KitRun = z.infer<typeof kitRunSchema>;
export function newKitRun(): KitRun { return { used: { opening: 0, supplement: 0 }, fallbacks: { opening: false, supplement: false }, enrichments: { opening: 0, supplement: 0 }, completed: [], completedRevisions: {}, started: [] }; }
/** Validate private recovery content before a recreated worker can call a model. */
export function validateKitComponentCheckpoint(value: KitCheckpoint, schema: z.ZodType, requireFocus = true): KitCheckpoint {
  const parsed = checkpointSchema.parse(value);
  if (!parsed.repair || !parsed.sources?.length || requireFocus && !parsed.focusedSources?.length) throw new Error("Incomplete component checkpoint");
  candidateSchema(schema).parse(parsed.candidate); candidateSchema(schema).parse(parsed.repair.candidate);
  if (fingerprint(parsed.candidate) !== fingerprint(parsed.repair.candidate)) throw new Error("Checkpoint candidate differs from repair state");
  const sources = parsed.sources;
  const exactGroup = (group: Source[]) => {
    if (new Set(group.map(s => s.id)).size !== group.length || group.some(s => !sources.some(old => fingerprint(old) === fingerprint(s)))) throw new Error("Checkpoint evidence differs from source registry");
  };
  exactGroup(sources); if (parsed.focusedSources) exactGroup(parsed.focusedSources);
  const safePointer = (pointer: string) => pointer.startsWith("/") && pointer !== "/" && !/~(?:[^01]|$)/.test(pointer) && pointer.slice(1).split("/").map(part => part.replaceAll("~1", "/").replaceAll("~0", "~")).every(part => !["__proto__", "prototype", "constructor"].includes(part));
  const proofGroup = (ids: string[], expected: string) => {
    if (new Set(ids).size !== ids.length) throw new Error("Duplicate checkpoint proof source");
    const group = ids.map(id => sources.find(s => s.id === id));
    if (group.some(s => !s) || fingerprint(group) !== expected) throw new Error("Checkpoint proof source binding differs");
    return group as Source[];
  };
  for (const entry of parsed.repair.ledger) {
    // Resolved/relocated history may refer to leaves removed by an approved
    // replacement. Current edit authorization still comes from targetCatalog.
    if ([...entry.targets, ...(entry.dependencies ?? []), ...(entry.artifact ? [entry.artifact] : [])].some(path => !safePointer(path))) throw new Error("Checkpoint ledger names an unsafe target");
    if (entry.sourceIds.some(id => !sources.some(s => s.id === id))) throw new Error("Checkpoint ledger cites missing sources");
    if (entry.sourceProof) {
      const group = entry.sourceProof.sourceIds ? proofGroup(entry.sourceProof.sourceIds, entry.sourceProof.sources) : sources;
      validateEvidenceDecision({ id: entry.id, disposition: "supported-defect", rationale: entry.evidence, support: entry.sourceProof.support, requirement: entry.sourceProof.requirement }, { sources: group } as any);
    }
    if (entry.adjudication) validateEvidenceDecision({ id: entry.id, disposition: "unsupported-review-demand", rationale: entry.adjudication.rationale, support: entry.adjudication.support, requirement: "" }, { sources } as any);
  }
  for (const [, raw] of parsed.evidenceDecisions ?? []) for (const decision of z.array(decisionSchema).max(20).parse(raw)) {
    const group = proofGroup(decision.receipt.sourceIds, decision.receipt.sources);
    if (decision.receipt.decision !== evidenceDecisionDigest(decision)) throw new Error("Checkpoint adjudication decision differs");
    validateEvidenceDecision(decision, { sources: group } as any);
  }
  return parsed;
}
/** Opaque identities only; worker drafts never cross the storage bridge. */
export class KitCheckpoints {
  constructor(private root: string, private paperId: string, private beforeWrite?: () => Promise<void>) {}
  private file(id: string) { return path.join(this.root, fingerprint(this.paperId), fingerprint(id) + ".json"); }
  async read(id: string, binding: string): Promise<KitCheckpoint | undefined> {
    try {
      const file = this.file(id);
      if ((await stat(file)).size > 8_000_000) return;
      const data = checkpointSchema.parse(JSON.parse(await readFile(file, "utf8")));
      if (data.version === 1 && data.binding === binding && data.componentId === id) return data;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError) && !(error instanceof z.ZodError)) throw error; }
  }
  async write(value: KitCheckpoint) {
    value = checkpointSchema.parse(value);
    await this.beforeWrite?.();
    const file = this.file(value.componentId);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const text = JSON.stringify(value);
    if (Buffer.byteLength(text) > 8_000_000) throw new Error("Checkpoint exceeds bound");
    await writeFile(file + ".tmp", text, { mode: 0o600 }); await rename(file + ".tmp", file);
  }
}
