import type { Target } from "./repair-controller";

export type ValidationFinding = {
  invariant: string; objectId: string; paths: string[]; dependencies: string[];
  message: string; fatal?: boolean;
};
export const validationKey = (finding: ValidationFinding) => `${finding.objectId}:${finding.invariant}`;
export function validationProgress(before: ValidationFinding[], after: ValidationFinding[], targets: Pick<Target,"path">[]) {
  if (after.some(f => f.fatal)) return false;
  const old = new Set(before.map(validationKey)), remaining = new Set(after.map(validationKey));
  if (after.some(f => !old.has(validationKey(f)))) return false;
  const intersects = (a: string, b: string) => a === b || a.startsWith(b + "/") || b.startsWith(a + "/");
  const affected = before.filter(f => [...f.paths, ...f.dependencies].some(p => targets.some(t => intersects(p, t.path))));
  return affected.every(f => !remaining.has(validationKey(f)));
}
/** Collect all independent checks; unsafe/schema failures prevent rendering. */
export function collectValidation(checks: { invariant: string; objectId: string; paths: string[]; dependencies?: string[]; fatal?: boolean; check(): void }[]): ValidationFinding[] {
  const findings = checks.flatMap(({ check, dependencies = [], ...identity }) => {
    try { check(); return []; } catch (error) {
      return [{ ...identity, dependencies, message: error instanceof Error ? error.message.slice(0, 1000) : "Validation failed" }];
    }
  });
  if(findings.length>64)return [...findings.slice(0,63),{invariant:"finding-capacity",objectId:"component",paths:[],dependencies:[],message:"Validation findings exceed the bounded repair catalogue",fatal:true}];
  return findings;
}

/** A container replacement does not make unchanged siblings part of the edit. */
export function changedFieldPaths(before: unknown, after: unknown, base = ""): string[] {
  if(Object.is(before,after))return [];
  if(before&&after&&typeof before==="object"&&typeof after==="object"&&Array.isArray(before)===Array.isArray(after)) {
    const a=before as Record<string,unknown>,b=after as Record<string,unknown>;
    return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(key=>changedFieldPaths(a[key],b[key],base+"/"+key.replaceAll("~","~0").replaceAll("/","~1")));
  }
  return [base||"/"];
}
