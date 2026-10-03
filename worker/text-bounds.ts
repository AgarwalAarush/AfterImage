import { z } from "zod";
import type { ValidationFinding } from "./validation-findings";
/** Keep complete private draft text. Native schemas remain the publication authority. */
export function candidateSchema<T>(schema: z.ZodType<T>): z.ZodType<T> {
  const json = z.toJSONSchema(schema);
  function visit(value: any) {
    if (!value || typeof value !== "object") return;
    if (value.type === "string" && typeof value.maxLength === "number") value.maxLength = Math.max(value.maxLength, 20000);
    for (const child of Object.values(value)) if (Array.isArray(child)) child.forEach(visit); else visit(child);
  }
  visit(json);
  return z.fromJSONSchema(json) as z.ZodType<T>;
}
export function textBoundFindings(candidate: unknown, native: z.ZodType): ValidationFinding[] {
  const result = native.safeParse(candidate);
  if (result.success) return [];
  if (result.error.issues.some(i => i.code !== "too_big" || i.origin !== "string")) throw result.error;
  return result.error.issues.map(i => {
    const pointer = "/" + i.path.map(p => String(p).replaceAll("~", "~0").replaceAll("/", "~1")).join("/");
    return { invariant: "native-text-length", objectId: pointer, paths: [pointer], dependencies: [], message: i.message };
  });
}
